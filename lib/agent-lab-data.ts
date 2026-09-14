export type RunStatus = "ready" | "running" | "completed" | "failed"
export type ProviderId = "openai" | "claude"
export type EventType =
  | "thinking"
  | "file"
  | "search"
  | "shell"
  | "edit"
  | "test-failure"
  | "retry"
  | "success"

export interface DiffLine {
  type: "add" | "del" | "ctx"
  text: string
}

export interface EventDrawer {
  category: string
  subtype?: string
  command?: string
  output?: string
  duration?: string
  filename?: string
  diff?: DiffLine[]
  note?: string
}

export interface TimelineEvent {
  id: string
  type: EventType
  title: string
  subtitle?: string
  filename?: string
  meta?: string
  diff?: { added: number; removed: number }
  drawer: EventDrawer
}

export interface AgentMetrics {
  duration: string
  steps: number
  toolCalls: number
  filesChanged: number
  tests: string
  retries: number
  cost: string
}

export interface AgentConfig {
  id: ProviderId
  vendor: string
  name: string
  model: string
  environment: string
  capabilities: string[]
  elapsed: string
}

export interface RunHistoryItem {
  title: string
  agents: number
  status: string
  active?: boolean
}

export interface EvalRow {
  label: string
  openai: number
  claude: number
}

export const openaiConfig: AgentConfig = {
  id: "openai",
  vendor: "OpenAI",
  name: "Agent API",
  model: "GPT-5.6",
  environment: "Managed Sandbox",
  capabilities: ["Shell", "Files", "Web", "Tools", "Subagents"],
  elapsed: "02:43",
}

export const claudeConfig: AgentConfig = {
  id: "claude",
  vendor: "Anthropic",
  name: "Claude Managed Agents",
  model: "Claude Opus",
  environment: "Managed Agent",
  capabilities: ["Shell", "Files", "Web", "Tools", "Persistent session"],
  elapsed: "03:18",
}

export const openaiMetrics: AgentMetrics = {
  duration: "7m 23s",
  steps: 15,
  toolCalls: 31,
  filesChanged: 2,
  tests: "13 / 13",
  retries: 1,
  cost: "$0.84",
}

export const claudeMetrics: AgentMetrics = {
  duration: "8m 41s",
  steps: 16,
  toolCalls: 27,
  filesChanged: 2,
  tests: "13 / 13",
  retries: 2,
  cost: "$1.12",
}

export const openaiTimeline: TimelineEvent[] = [
  {
    id: "o1",
    type: "thinking",
    title: "Planning implementation",
    subtitle: "Identified authentication flow and redirect logic.",
    drawer: {
      category: "Reasoning",
      note: "Goal: redirect authenticated users from `/` to `/mypage`. Plan:\n1. Locate auth/session handling in middleware.\n2. Add a guard for the homepage path.\n3. Add a regression test and run the full suite.",
    },
  },
  {
    id: "o2",
    type: "search",
    title: "Searching for authentication middleware",
    drawer: {
      category: "Tool call",
      subtype: "Search",
      command: 'grep -r "session" src/',
      output:
        "src/middleware.ts\nsrc/lib/auth.ts\nsrc/app/page.tsx\n\n3 files matched",
      duration: "0.4s",
    },
  },
  {
    id: "o3",
    type: "file",
    title: "Read",
    filename: "src/middleware.ts",
    drawer: {
      category: "File read",
      filename: "src/middleware.ts",
      output:
        'import { NextResponse } from "next/server"\nimport { getSession } from "@/lib/auth"\n\nexport async function middleware(request) {\n  const session = await getSession(request)\n  return NextResponse.next()\n}',
      duration: "0.2s",
    },
  },
  {
    id: "o4",
    type: "file",
    title: "Read",
    filename: "src/app/page.tsx",
    drawer: {
      category: "File read",
      filename: "src/app/page.tsx",
      output:
        'export default function HomePage() {\n  return <main>Welcome</main>\n}',
      duration: "0.1s",
    },
  },
  {
    id: "o5",
    type: "edit",
    title: "Edited",
    filename: "src/middleware.ts",
    diff: { added: 14, removed: 3 },
    drawer: {
      category: "File edit",
      filename: "src/middleware.ts",
      diff: [
        { type: "ctx", text: "  const session = await getSession(request)" },
        { type: "ctx", text: "  const { pathname } = request.nextUrl" },
        { type: "add", text: '  if (session?.user && pathname === "/") {' },
        {
          type: "add",
          text: '    return NextResponse.redirect(new URL("/mypage", request.url))',
        },
        { type: "add", text: "  }" },
        { type: "ctx", text: "  return NextResponse.next()" },
      ],
    },
  },
  {
    id: "o6",
    type: "shell",
    title: "pnpm test",
    meta: "1 failed",
    drawer: {
      category: "Tool call",
      subtype: "Shell",
      command: "pnpm test",
      output:
        "PASS  src/lib/auth.test.ts\nFAIL  src/middleware.test.ts\n  ✕ redirects authenticated users to /mypage\n\n12 passed, 1 failed",
      duration: "8.4s",
    },
  },
  {
    id: "o7",
    type: "test-failure",
    title: "Test failed",
    subtitle: "redirects authenticated users to /mypage",
    drawer: {
      category: "Test failure",
      note: "Expected redirect to /mypage but received 200. The test mock did not attach a user to the session object.",
    },
  },
  {
    id: "o8",
    type: "retry",
    title: "Investigating failed test",
    subtitle: "Updated mock session handling.",
    drawer: {
      category: "Reasoning",
      note: "The failing test stubs `getSession` but returns an empty object. Updating the mock to return a user so the redirect branch is exercised.",
    },
  },
  {
    id: "o9",
    type: "edit",
    title: "Edited",
    filename: "src/middleware.test.ts",
    diff: { added: 6, removed: 1 },
    drawer: {
      category: "File edit",
      filename: "src/middleware.test.ts",
      diff: [
        { type: "del", text: "  getSession.mockResolvedValue({})" },
        {
          type: "add",
          text: '  getSession.mockResolvedValue({ user: { id: "u_1" } })',
        },
      ],
    },
  },
  {
    id: "o10",
    type: "shell",
    title: "pnpm test",
    meta: "13 passed",
    drawer: {
      category: "Tool call",
      subtype: "Shell",
      command: "pnpm test",
      output: "PASS  src/lib/auth.test.ts\nPASS  src/middleware.test.ts\n\n13 passed",
      duration: "8.1s",
    },
  },
  {
    id: "o11",
    type: "success",
    title: "All tests passed",
    subtitle: "13 / 13",
    drawer: {
      category: "Result",
      note: "All 13 tests passing. 2 files changed: src/middleware.ts, src/middleware.test.ts.",
    },
  },
]

export const claudeTimeline: TimelineEvent[] = [
  {
    id: "c1",
    type: "thinking",
    title: "Planning approach",
    subtitle: "Mapped auth guard and homepage redirect requirements.",
    drawer: {
      category: "Reasoning",
      note: "Breaking the task into: inspect middleware, confirm session shape, add homepage guard, then cover it with tests before running the full suite.",
    },
  },
  {
    id: "c2",
    type: "file",
    title: "Read",
    filename: "src/middleware.ts",
    drawer: {
      category: "File read",
      filename: "src/middleware.ts",
      output:
        'import { NextResponse } from "next/server"\nimport { getSession } from "@/lib/auth"\n\nexport async function middleware(request) {\n  const session = await getSession(request)\n  return NextResponse.next()\n}',
      duration: "0.2s",
    },
  },
  {
    id: "c3",
    type: "search",
    title: "Searching for session helpers",
    drawer: {
      category: "Tool call",
      subtype: "Search",
      command: 'grep -rn "getSession" src/',
      output: "src/lib/auth.ts:12\nsrc/middleware.ts:2\n\n2 matches",
      duration: "0.5s",
    },
  },
  {
    id: "c4",
    type: "file",
    title: "Read",
    filename: "src/lib/auth.ts",
    drawer: {
      category: "File read",
      filename: "src/lib/auth.ts",
      output:
        "export async function getSession(request) {\n  // returns { user } | null\n}",
      duration: "0.1s",
    },
  },
  {
    id: "c5",
    type: "edit",
    title: "Edited",
    filename: "src/middleware.ts",
    diff: { added: 12, removed: 2 },
    drawer: {
      category: "File edit",
      filename: "src/middleware.ts",
      diff: [
        { type: "ctx", text: "  const session = await getSession(request)" },
        { type: "add", text: '  if (session?.user && request.nextUrl.pathname === "/") {' },
        {
          type: "add",
          text: '    return NextResponse.redirect(new URL("/MyPage", request.url))',
        },
        { type: "add", text: "  }" },
        { type: "ctx", text: "  return NextResponse.next()" },
      ],
    },
  },
  {
    id: "c6",
    type: "shell",
    title: "pnpm test",
    meta: "2 failed",
    drawer: {
      category: "Tool call",
      subtype: "Shell",
      command: "pnpm test",
      output:
        "FAIL  src/middleware.test.ts\n  ✕ redirects authenticated users to /mypage\n  ✕ preserves query string on redirect\n\n11 passed, 2 failed",
      duration: "9.2s",
    },
  },
  {
    id: "c7",
    type: "test-failure",
    title: "Test failed",
    subtitle: "redirects authenticated users to /mypage",
    drawer: {
      category: "Test failure",
      note: 'Redirect target was "/MyPage" but the expected path is "/mypage". Casing mismatch.',
    },
  },
  {
    id: "c8",
    type: "retry",
    title: "Investigating failed test",
    subtitle: "Adjusted redirect target casing.",
    drawer: {
      category: "Reasoning",
      note: "Fixing the redirect URL casing from /MyPage to /mypage to match the expected route.",
    },
  },
  {
    id: "c9",
    type: "edit",
    title: "Edited",
    filename: "src/middleware.ts",
    diff: { added: 3, removed: 1 },
    drawer: {
      category: "File edit",
      filename: "src/middleware.ts",
      diff: [
        {
          type: "del",
          text: '    return NextResponse.redirect(new URL("/MyPage", request.url))',
        },
        {
          type: "add",
          text: '    return NextResponse.redirect(new URL("/mypage", request.url))',
        },
      ],
    },
  },
  {
    id: "c10",
    type: "shell",
    title: "pnpm test",
    meta: "1 failed",
    drawer: {
      category: "Tool call",
      subtype: "Shell",
      command: "pnpm test",
      output:
        "FAIL  src/middleware.test.ts\n  ✕ redirects authenticated users to /mypage\n\n12 passed, 1 failed",
      duration: "8.7s",
    },
  },
  {
    id: "c11",
    type: "test-failure",
    title: "Test still failing",
    subtitle: "mock session missing user id",
    drawer: {
      category: "Test failure",
      note: "The redirect branch is never reached because the mocked session has no user. The fixture needs a user object.",
    },
  },
  {
    id: "c12",
    type: "retry",
    title: "Reworking test mocks",
    subtitle: "Rebuilt session fixture.",
    drawer: {
      category: "Reasoning",
      note: "Replacing the ad-hoc session stub with a shared fixture that includes an authenticated user.",
    },
  },
  {
    id: "c13",
    type: "edit",
    title: "Edited",
    filename: "src/middleware.test.ts",
    diff: { added: 8, removed: 2 },
    drawer: {
      category: "File edit",
      filename: "src/middleware.test.ts",
      diff: [
        { type: "del", text: "  getSession.mockResolvedValue(null)" },
        { type: "add", text: "  const session = { user: { id: 'u_1' } }" },
        { type: "add", text: "  getSession.mockResolvedValue(session)" },
      ],
    },
  },
  {
    id: "c14",
    type: "shell",
    title: "pnpm test",
    meta: "13 passed",
    drawer: {
      category: "Tool call",
      subtype: "Shell",
      command: "pnpm test",
      output: "PASS  src/middleware.test.ts\nPASS  src/lib/auth.test.ts\n\n13 passed",
      duration: "8.9s",
    },
  },
  {
    id: "c15",
    type: "success",
    title: "All tests passed",
    subtitle: "13 / 13",
    drawer: {
      category: "Result",
      note: "All 13 tests passing after 2 retries. 2 files changed: src/middleware.ts, src/middleware.test.ts.",
    },
  },
]

export const runHistory: RunHistoryItem[] = [
  { title: "Bug fix: auth redirect", agents: 2, status: "Completed", active: true },
  { title: "Analyze CSV anomalies", agents: 2, status: "Completed" },
  { title: "Research database options", agents: 2, status: "Completed" },
]

export const evaluation: EvalRow[] = [
  { label: "Task completion", openai: 5, claude: 5 },
  { label: "Speed", openai: 5, claude: 4 },
  { label: "Cost efficiency", openai: 5, claude: 3 },
  { label: "Tool efficiency", openai: 4, claude: 5 },
  { label: "Recovery from failure", openai: 4, claude: 5 },
  { label: "Code quality", openai: 4, claude: 5 },
]
