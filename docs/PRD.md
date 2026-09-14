# Agent Lab PRD

## 1. 概要

### プロダクト名
Agent Lab

### コンセプト
OpenAI Agent API と Claude Managed Agents に同一タスクを実行させ、**結果だけでなく、Agent がどのように仕事を進めたかまで比較・観察できる開発者向け検証ツール**。

### 一言で表すと
Managed Agent の挙動を比較・学習するための Agent Execution Playground。

---

# 2. 背景

OpenAI Agent API や Claude Managed Agents のような Managed Agent 基盤では、従来の単純な LLM API と異なり、

- 長時間タスク
- Tool 利用
- Shell 実行
- ファイル操作
- Sandbox
- Retry
- 状態管理
- Subagent
- Persistent session

など、Agent の「仕事の進め方」そのものが API / Platform 側で管理される。

そのため、単純にプロンプトを入力して回答を比較するだけでは、両サービスの特性を十分に理解できない。

Agent Lab では、同一の実務的タスクを複数 Agent に実行させ、その過程を可視化することで、

- Agent API の使い方を学ぶ
- Managed Agent の設計思想を理解する
- OpenAI / Anthropic の違いを把握する
- 実際のプロダクトへの組み込み方を検討する

ことを目的とする。

---

# 3. 目的

## 3.1 Primary Goal

OpenAI Agent API と Claude Managed Agents を実際に利用し、Managed Agent の以下の特性を理解する。

- Task execution
- Tool use
- File operations
- Shell execution
- Long-running tasks
- Retry / recovery
- Agent state
- Observability
- Cost
- Execution time
- Output quality

## 3.2 Secondary Goal

将来的に Agent を業務システムへ組み込む際の、

- UI / UX
- API abstraction
- 実行管理
- 状態管理
- Cost 管理
- Logging
- Human-in-the-loop

の設計パターンを検証する。

---

# 4. 非目的

初期バージョンでは以下を目的としない。

- OpenAI と Claude の絶対的な性能ランキングを決める
- 公開 Benchmark を構築する
- 大規模な Agent orchestration platform を作る
- Multi-tenant SaaS として公開する
- Agent SDK を独自実装する
- 独自 Sandbox を構築する
- Production 用 CI/CD Agent を作る

あくまで、

**Managed Agent を使って理解するための実験環境**

を優先する。

---

# 5. 想定ユーザー

## Primary User

生成 AI / Agent 技術をキャッチアップしたいエンジニア。

特に、

- Web Engineer
- Tech Lead
- CTO
- AI Engineer
- Product Engineer

を想定する。

## User Needs

ユーザーは以下を知りたい。

- Managed Agent は普通の LLM API と何が違うのか
- Agent が実際に何をしているのか
- OpenAI と Claude でどう挙動が違うのか
- API をどう実装すればよいのか
- 長時間 Agent の状態をどう UI で表現すればよいのか
- Agent のコストはどの程度か
- Agent が失敗した場合どう復旧するのか

---

# 6. 基本ユースケース

## UC-01 Coding Task

ユーザーが GitHub Repository とタスクを入力する。

例：

> ログイン済みユーザーがトップページにアクセスした場合、/mypage にリダイレクトするよう修正してください。テストも追加してください。

OpenAI Agent と Claude Agent がそれぞれ、

1. Repository を調査
2. 関連ファイルを探索
3. 実装方法を判断
4. コードを編集
5. テスト実行
6. 失敗時に修正
7. 最終結果を返却

する。

Agent Lab はその過程をリアルタイム表示する。

---

## UC-02 Research Task

例：

> Vercel / Neon / Supabase を比較し、このプロジェクトに適した構成を report.md にまとめてください。

Agent が、

- Web Search
- 情報収集
- 比較
- Markdown 作成

を行う。

---

## UC-03 Data Analysis Task

ユーザーが CSV 等を渡す。

例：

> データを分析し、異常値を抽出して analysis.md を作成してください。

Agent が、

- File 読み込み
- Python / Shell 実行
- 分析
- ファイル生成

を行う。

---

# 7. MVP Scope

初期 MVP では Coding Task を中心とする。

## 対応 Agent

- OpenAI Agent API
- Claude Managed Agents

## 対応 Task Type

- Coding
- Research
- Data Analysis
- General

ただし MVP の主要検証対象は Coding。

---

# 8. ユーザーフロー

## Step 1

ユーザーが Agent Lab を開く。

## Step 2

Task を入力。

必要に応じて、

- Repository
- Branch
- Task Type

を指定。

## Step 3

利用する Agent を選択。

- OpenAI
- Claude
- Both

## Step 4

Run Agents を押す。

## Step 5

各 Agent が実行開始。

画面にはリアルタイムで、

- Planning
- Search
- File read
- Shell
- Edit
- Test
- Retry
- Success
- Error

などが表示される。

## Step 6

実行終了。

以下を表示。

- Final Result
- Files Changed
- Tests
- Duration
- Tool Calls
- Retries
- Cost

## Step 7

OpenAI / Claude の結果を比較する。

---

# 9. 機能要件

## FR-01 Task Input

ユーザーは自然言語で Task を入力できる。

### Fields

- Task
- Repository
- Branch
- Task Type

---

# FR-02 Agent Selection

以下から選択可能。

- OpenAI Agent API
- Claude Managed Agents

両方同時選択可能。

---

# FR-03 Agent Execution

Run 実行時に Agent を起動する。

各 Agent は独立して実行する。

片方が失敗しても、もう片方の実行を停止しない。

---

# FR-04 Execution Status

Agent ごとに Status を管理する。

States:

- Ready
- Queued
- Running
- Completed
- Failed
- Cancelled

---

# FR-05 Event Timeline

Agent の実行イベントを Timeline として保存・表示する。

Event Types:

- planning
- thinking
- search
- file_read
- file_write
- shell
- tool_call
- test
- retry
- warning
- error
- success
- final_output

---

# FR-06 Event Detail

Timeline の各 Event をクリックすると詳細を表示する。

例：

## Shell

Command

`pnpm test`

Output

`13 tests passed`

Duration

`8.4 sec`

---

## File Edit

File

`src/middleware.ts`

Diff

```diff
+ if (session?.user && pathname === "/") {
+   return NextResponse.redirect(
+     new URL("/mypage", request.url)
+   )
+ }
```

---

# FR-07 Real-time Update

Agent 実行中は Timeline を逐次更新する。

候補：

- Server-Sent Events
- WebSocket
- Polling

MVP では実装容易性を優先してよい。

---

# FR-08 Agent Stop

Running 状態の Agent を停止可能とする。

Agent ごとに個別停止可能。

---

# FR-09 Execution Metrics

Agent ごとに以下を取得・表示する。

- Duration
- Steps
- Tool Calls
- Files Changed
- Tests
- Retries
- Estimated Cost

取得できない値については null を許容する。

---

# FR-10 Final Result

Agent の最終回答を保存する。

表示項目：

- Summary
- Status
- Changed Files
- Test Result
- Final Output

---

# FR-11 Result Comparison

OpenAI / Claude を比較表示する。

比較項目：

- Result
- Duration
- Steps
- Tool Calls
- Retries
- Cost
- Files Changed
- Tests

---

# FR-12 Evaluation

ユーザーが Agent の実行結果を手動評価できる。

評価項目：

- Task completion
- Speed
- Cost efficiency
- Tool efficiency
- Recovery from failure
- Code quality

Score:

1〜5

自動評価ではなく、初期版ではユーザー評価とする。

---

# FR-13 Run History

過去の Agent Run を保存する。

表示項目：

- Task title
- Created at
- Providers
- Status
- Duration

Run を選択すると過去の Timeline と結果を再表示できる。

---

# 10. 画面構成

## Main Page

### Header

- Agent Lab
- Run History
- Settings

### Task Area

- Task textarea
- Repository
- Branch
- Task Type

### Agent Selection

OpenAI Agent API

Claude Managed Agents

### Action

Run both agents

### Execution Area

左右2カラム。

Left:

OpenAI

Right:

Claude

### Timeline

Agent のイベントを縦方向に表示。

### Metrics

Agent の execution metrics。

### Result

Final output。

### Comparison

両 Agent の比較。

---

# 11. UI / UX 方針

## Design

ライトモードを基本とする。

### Visual Direction

- 白背景
- Border 中心
- Shadow は最小限
- 適度な余白
- 高密度だが圧迫感を出さない

参考イメージ：

- GitHub
- Linear
- Vercel
- Stripe Dashboard
- OpenAI Platform

## UI Philosophy

説明文を大量に表示しない。

Agent の状態は、

- Icon
- Status
- Timeline
- Diff
- Metrics

で理解できるようにする。

---

# 12. Agent Provider Abstraction

OpenAI / Claude 固有実装を UI から分離する。

例：

```ts
interface AgentProvider {
  createRun(input: AgentRunInput): Promise<AgentRun>;
  getRun(runId: string): Promise<AgentRun>;
  cancelRun(runId: string): Promise<void>;
}
```

Provider implementations:

```ts
OpenAIAgentProvider

ClaudeManagedAgentProvider
```

UI は Provider の違いを意識しない。

---

# 13. 共通 Event Model

Provider 固有 Event を内部の共通形式へ変換する。

```ts
type AgentEvent = {
  id: string;
  runId: string;
  provider: "openai" | "anthropic";

  type:
    | "planning"
    | "search"
    | "file_read"
    | "file_write"
    | "shell"
    | "tool_call"
    | "test"
    | "retry"
    | "warning"
    | "error"
    | "success"
    | "final_output";

  title: string;

  detail?: string;

  timestamp: string;

  durationMs?: number;

  metadata?: Record<string, unknown>;
};
```

この共通 Event Model を Agent Lab の中心データ構造とする。

---

# 14. Run Data Model

```ts
type AgentRun = {
  id: string;

  taskId: string;

  provider:
    | "openai"
    | "anthropic";

  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";

  startedAt?: string;

  completedAt?: string;

  events: AgentEvent[];

  result?: AgentResult;

  metrics?: AgentMetrics;
};
```

---

# 15. Metrics Model

```ts
type AgentMetrics = {
  durationMs?: number;

  steps?: number;

  toolCalls?: number;

  filesChanged?: number;

  retries?: number;

  inputTokens?: number;

  outputTokens?: number;

  estimatedCost?: number;
};
```

---

# 16. Task Model

```ts
type AgentTask = {
  id: string;

  title: string;

  prompt: string;

  type:
    | "coding"
    | "research"
    | "data"
    | "general";

  repository?: string;

  branch?: string;

  createdAt: string;
};
```

---

# 17. システム構成案

```text
Browser

   ↓

Next.js

   ↓

Agent Orchestrator

   ├── OpenAI Agent Provider
   │
   └── Claude Managed Agent Provider

   ↓

Event Normalizer

   ↓

Database

   ↓

Realtime Event Stream
```

---

# 18. 技術構成

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

Next.js Route Handler を基本とする。

必要に応じて Worker 化を検討する。

## Database

初期版は以下のいずれか。

- Neon PostgreSQL
- Supabase PostgreSQL

保存対象：

- Tasks
- Runs
- Events
- Metrics
- Evaluations

---

# 19. API

## Create Task Run

```text
POST /api/runs
```

Request:

```json
{
  "task": "...",
  "repository": "...",
  "branch": "main",
  "providers": [
    "openai",
    "anthropic"
  ]
}
```

Response:

```json
{
  "runs": [
    {
      "id": "run_openai_xxx",
      "provider": "openai"
    },
    {
      "id": "run_claude_xxx",
      "provider": "anthropic"
    }
  ]
}
```

---

## Get Run

```text
GET /api/runs/:id
```

---

## Events

```text
GET /api/runs/:id/events
```

---

## Cancel

```text
POST /api/runs/:id/cancel
```

---

# 20. Security

Agent はコード実行や File 操作を伴うため、安全性を重要視する。

最低限、

- API Key を Client に渡さない
- Sandbox 外への File Access を禁止
- Secret を Agent Input に含めない
- Shell Command をログ化
- Tool Call をログ化
- Agent Run ごとに Sandbox を分離

する。

将来的には、

- Network allowlist
- Tool permission
- Human approval
- GitHub write permission

なども検討する。

---

# 21. GitHub Integration

MVP では Repository URL の入力まででよい。

Phase 2 で GitHub App 連携を追加する。

将来的なフロー：

```text
GitHub Repository

↓

Agent

↓

Branch creation

↓

Code changes

↓

Test

↓

Pull Request
```

ただし初期版では PR 作成を必須としない。

---

# 22. MVP の成功条件

以下が確認できれば MVP 成功とする。

### 1

OpenAI Agent API に Task を送信できる。

### 2

Claude Managed Agents に同一 Task を送信できる。

### 3

両 Agent の実行状態を UI で確認できる。

### 4

Agent の Tool / File / Shell 操作を Timeline 表示できる。

### 5

最終結果を比較できる。

### 6

Duration / Tool Calls / Retry 等の基本 Metrics を比較できる。

### 7

実際に使うことで、

「Managed Agent が従来の LLM API と何が違うのか」

を理解できる。

---

# 23. 実装フェーズ

## Phase 0
UI Mock

- v0 で UI 作成
- Mock Data
- Ready / Running / Completed / Failed の状態表現

---

## Phase 1
OpenAI Agent Integration

OpenAI Agent API のみ接続。

確認対象：

- Run
- Event
- Tool
- File
- Shell
- Result

この段階で Agent Execution UI を完成させる。

---

## Phase 2
Claude Integration

Claude Managed Agents を追加。

Provider abstraction を完成させる。

---

## Phase 3
Comparison

- Metrics
- Comparison
- Evaluation
- Run history

---

## Phase 4
Real Task

実際の GitHub Repository に対して Coding Task を実行。

---

# 24. 最初に用意する検証タスク

## Task A
Coding

ログイン済みユーザーのリダイレクト処理を追加する。

評価対象：

- Repository exploration
- File edit
- Test
- Retry

---

## Task B
Research

Vercel / Neon / Supabase を比較する。

評価対象：

- Search
- Information gathering
- Report generation

---

## Task C
Data Analysis

CSV の異常値を調査する。

評価対象：

- File access
- Code execution
- Analysis
- Artifact generation

---

# 25. 将来的な拡張

## Benchmark

同じ Task を複数回実行し統計化。

例えば：

- Success Rate
- Average Cost
- Average Duration
- Retry Rate

---

## More Providers

将来的に、

- Gemini Agent
- Grok
- Local Agent

などを追加可能な構造とする。

---

## Human-in-the-loop

Agent が重要操作を行う際に、

Approval required

を表示。

例：

- File delete
- Git push
- PR creation
- External API write

---

## Agent Replay

Agent Run を Timeline として再生。

どの順番で判断・Tool利用したかを観察できるようにする。

---

# 26. このプロダクトで最も重要なこと

Agent Lab では、

**「どちらのモデルが賢いか」だけを比較しない。**

見るべき対象は、

**Agent がどのように仕事を進めるか**

である。

そのため、UIでも Final Answer より、

- Planning
- Tools
- Files
- Shell
- Errors
- Retry
- Recovery
- Metrics

を重要視する。

最終的にユーザーが、

> 「Managed Agent とは、単に賢いモデルを呼ぶ仕組みではなく、モデルが継続的に仕事を進めるための実行環境・Harnessまで含んだ仕組みである」

と理解できるプロダクトを目指す。