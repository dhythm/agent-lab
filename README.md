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
| `ANTHROPIC_API_KEY` | Claude Managed Agents (`client.beta.agents / environments / sessions`) |
| `GITHUB_TOKEN` | 任意。private リポジトリを clone する場合の fine-grained PAT (Contents: Read) |
| `AGENT_LAB_MOCK_PROVIDERS` | 任意。`openai,anthropic` を指定すると API を呼ばずに台本化した Timeline を再生する |

API キーを一切設定せずに UI を確認したい場合:

```bash
AGENT_LAB_MOCK_PROVIDERS=openai,anthropic pnpm dev
```

## 使い方

1. Task / Repository (`owner/repo` または URL) / Branch / Task type を入力
2. 実行する Agent を選択 (片方だけでも可)
3. Run を押すと各 Agent が独立に実行され、Timeline がリアルタイムに更新される
4. 各ステップをクリックするとコマンド・ファイル・差分・出力を確認できる
5. 完了後に Result comparison と Evaluation (1〜5) が表示される。History から過去の Run を再表示できる

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
- **保存**: Tasks / Runs / Events / Metrics / Evaluations を `.agent-lab/runs/*.json` に保存 (DB へは `RunStore` インタフェースの差し替えで移行可能)

## 開発

```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm build
```

Provider 固有イベントの正規化 (`lib/providers/*/normalize.ts`)、Metrics 集計、Orchestrator、RunStore はユニットテストで検証しています。
