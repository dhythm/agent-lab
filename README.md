# Agent Lab

OpenAI Agents API と Claude Managed Agents に同一タスクを実行させ、結果だけでなく **Agent がどのように仕事を進めたか** を並べて観察する開発者向けの検証ツールです。仕様は [docs/PRD.md](docs/PRD.md) を参照してください。

## セットアップ

```bash
pnpm install
cp .env.example .env.local   # API キーを記入 (サーバ側でのみ使用)
pnpm dev
```

| 変数 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI Agents API (`client.beta.agents.sessions`)。キー権限に `api.agents.read/write` が必要 |
| `OPENAI_AGENT_MODEL` | 任意。デフォルトは `gpt-5.6-sol` |
| `ANTHROPIC_API_KEY` | Claude Managed Agents (`client.beta.agents / environments / sessions`) |
| `GITHUB_TOKEN` | 任意。private リポジトリを clone する場合の fine-grained PAT (Contents: Read) |
| `AGENT_LAB_MOCK_PROVIDERS` | 任意。`openai,anthropic` を指定すると API を呼ばずに台本化した Timeline を再生する |

API キーを一切設定せずに UI を確認したい場合:

```bash
AGENT_LAB_MOCK_PROVIDERS=openai,anthropic pnpm dev
```

## 使い方

1. プリセットを選ぶか、Task / Repository (`owner/repo` または URL、任意) / Branch / Task type を入力し、必要ならファイルを添付
2. 実行する Agent を選択 (片方だけでも可)
3. Run を押すと各 Agent が独立に実行され、Timeline がリアルタイムに更新される
4. 各ステップをクリックするとコマンド・ファイル・差分・出力を確認できる
5. 完了後に Result comparison と Evaluation (1〜5) が表示される。History から過去の Run を再表示できる

### タスクのパターン (プリセット)

GitHub リポジトリが無くても試せるよう、添付ファイル付きのプリセットを用意しています (サンプルは `public/samples/`)。

| プリセット | 種別 | 観察できること |
| --- | --- | --- |
| Coding: auth redirect | coding | リポジトリ探索、編集、テスト実行、リトライ |
| Data: CSV anomaly analysis | data | ファイル読み込み、コード実行、異常値抽出、`analysis.md` / グラフの生成 |
| Data: customer list cleansing | data | 表記ゆれの正規化、JSON Schema バリデーション、判断ログ |
| Research: hosting comparison | research | Web 検索、情報収集、比較表付きレポート生成 |
| Document: meeting notes → summary | general | 文書理解、決定事項 / アクション抽出 |
| Coding: self-contained kata | coding | リポジトリ無しでの実装 + テスト。成果物は出力ディレクトリに保存 |
| Content: SEO article body | article | Task 欄が `{{変数}}` 入りのライター用プロンプト。添付 JSON で変数を埋めた本文が Agent に渡り、Agent が書いた article.json をスキーマと文字数目標で検証 |

添付ファイルはサンドボックスの `/workspace/inputs/` に配置されます。Agent が出力ディレクトリ (Anthropic: `/mnt/session/outputs`、OpenAI: `/workspace/outputs`) に書いたファイルは Run 完了後に取得され、Result から ダウンロードできます。

### 記事本文の生成 (テンプレート + 入力 → JSON)

Task type `Article (structured output)` では、Task 欄のテキストを **プロンプトのテンプレート** として扱います。`{{seoKeywords}}` `{{title}}` `{{chapters}}` `{{references}}` などの変数を添付 JSON (例: `public/samples/article-writer/article-input.json`) の値で埋め、末尾に出力先 (`article.json`) と JSON Schema を付けて、通常のタスクと同じように OpenAI / Claude の Agent へ渡します。Run 完了後、Agent が出力ディレクトリに書いた `article.json` (無ければ最終回答の JSON) をスキーマで検証し、章・節ごとの targetCharCount との差を Timeline に出します。結果の Tests 欄が `JSON schema: passed / failed` になります。

- 添付 JSON は `chapters` / `references` をテキストで持つ形式か、章・節・参照を構造化した `outline` を含む形式のどちらでもよい
- テンプレート側の変数と JSON の値が合わない (未知の変数、必須値の欠落) 場合は Agent を呼ばずに失敗する
- `/api/article` は同じテンプレートを Messages / Responses API の構造化出力で直接呼ぶ HTTP 入口 (サンドボックスなし)

```bash
curl -s -X POST http://localhost:3000/api/article \
  -H 'content-type: application/json' \
  -d @public/samples/article-writer/request.example.json | jq '.article.contents[0]'
```

## 仕組み

```
Browser ── SSE (/api/runs/:id/events) ──▶ Next.js Route Handlers
                                              │
                                        Orchestrator (lib/agent-lab/orchestrator.ts)
                                         ├── OpenAIProvider     (lib/providers/openai)
                                         └── AnthropicProvider  (lib/providers/anthropic)
                                              │  provider 固有イベント → 共通 AgentEvent (normalize.ts)
                                        RunStore (JSON files under .agent-lab/runs)
```

- **共通 Event Model** (`lib/agent-lab/types.ts`): `planning / thinking / search / file_read / file_write / shell / tool_call / test / retry / warning / error / success / final_output`
- **Metrics** (`lib/agent-lab/metrics.ts`): Duration / Steps / Tool calls / Files changed / Retries / Tokens / Estimated cost をイベントから集計
- **Anthropic**: Environment と Agent は初回に一度だけ作成し `.agent-lab/anthropic-resources.json` に ID をキャッシュ。Run ごとに Session を作成し、`github_repository` リソースで repo をマウント、SSE + 履歴 list で取りこぼしなく購読、Stop は `user.interrupt`。コストは Session の `usage.list_cost` から取得
- **OpenAI**: Run ごとに `openai_hosted` 環境で Session を作成し、`setup_commands` で `git clone`。`agent.session.turn.item.added/done` を Timeline に変換、Stop は `agent.session.input.cancel`。API がコストを返さないため、トークン数 × 単価 (env で上書き可) で推定
- **ファイル**: 添付は `.agent-lab/uploads/<taskId>/`、成果物は `.agent-lab/artifacts/<runId>/` に保存し、API からはファイル名とサイズだけを返す
- **保存**: Tasks / Runs / Events / Metrics / Evaluations を `.agent-lab/runs/*.json` に保存 (DB へは `RunStore` インタフェースの差し替えで移行可能)

## 開発

```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm build
```

Provider 固有イベントの正規化 (`lib/providers/*/normalize.ts`)、Metrics 集計、Orchestrator、RunStore はユニットテストで検証しています。
