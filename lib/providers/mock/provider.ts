import type {
  AgentProvider,
  ProviderRunHandle,
  ProviderRunOutcome,
  ProviderRunSink,
} from "@/lib/agent-lab/provider"
import type { NewAgentEvent, ProviderId } from "@/lib/agent-lab/types"
import type { FileStore } from "@/lib/agent-lab/files"
import { mockArticleFromPrompt } from "@/lib/providers/article/mock-article"

type Step = Omit<NewAgentEvent, "timestamp"> & { delayMs?: number; resultDelayMs?: number; result?: string }

const SCRIPT: Step[] = [
  { type: "planning", title: "Inspect the middleware, then add the redirect and a test.", detail: "Plan:\n1. Find session handling\n2. Add guard for /\n3. Add regression test\n4. Run the suite" },
  { type: "search", title: 'grep -rn "session" src/', metadata: { tool: "grep", command: 'grep -rn "session" src/' }, result: "src/middleware.ts:2\nsrc/lib/auth.ts:12" },
  { type: "file_read", title: "src/middleware.ts", metadata: { tool: "read", path: "src/middleware.ts" }, result: 'import { NextResponse } from "next/server"\nexport async function middleware(request) {\n  const session = await getSession(request)\n  return NextResponse.next()\n}' },
  { type: "thinking", title: "Thinking" },
  { type: "file_write", title: "src/middleware.ts", metadata: { tool: "edit", path: "src/middleware.ts", oldString: "  return NextResponse.next()", newString: '  if (session?.user && request.nextUrl.pathname === "/") {\n    return NextResponse.redirect(new URL("/mypage", request.url))\n  }\n  return NextResponse.next()' }, result: "ok" },
  { type: "test", title: "pnpm test", metadata: { tool: "bash", command: "pnpm test" }, resultDelayMs: 2500, result: "FAIL src/middleware.test.ts\n  ✕ redirects authenticated users to /mypage\n\n12 passed, 1 failed" },
  { type: "retry", title: "Retrying tests" },
  { type: "file_write", title: "src/middleware.test.ts", metadata: { tool: "edit", path: "src/middleware.test.ts", oldString: "getSession.mockResolvedValue({})", newString: 'getSession.mockResolvedValue({ user: { id: "u_1" } })' }, result: "ok" },
  { type: "test", title: "pnpm test", metadata: { tool: "bash", command: "pnpm test" }, resultDelayMs: 2500, result: "PASS src/middleware.test.ts\n\n13 passed" },
]

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("cancelled"))
    const timer = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new Error("cancelled"))
    })
  })
}

/**
 * Replays a scripted timeline with realistic pacing. Used to exercise the UI
 * and API without spending real API credits (AGENT_LAB_MOCK_PROVIDERS).
 */
export function createMockProvider(id: ProviderId, label: string, files: FileStore): AgentProvider {
  return {
    id,
    label,
    async startRun(input, sink: ProviderRunSink): Promise<ProviderRunHandle> {
      const abort = new AbortController()
      const done = (async (): Promise<ProviderRunOutcome> => {
        await sink.setExternalId(`mock_${id}_${input.runId.slice(-6)}`)
        await sleep(800, abort.signal)
        for (const step of SCRIPT) {
          const { delayMs, resultDelayMs, result, ...event } = step
          const stored = await sink.emit({ ...event, timestamp: new Date().toISOString() })
          await sleep(delayMs ?? 700, abort.signal)
          if (result !== undefined) {
            await sleep(resultDelayMs ?? 300, abort.signal)
            const failed = /failed|FAIL/.test(result) && step.type === "test"
            await sink.updateEvent(stored.id, {
              detail: result,
              durationMs: (resultDelayMs ?? 300) + 120,
              metadata: { ...event.metadata, status: failed ? "failed" : "completed" },
            })
          }
        }
        const attachments = input.task.attachments ?? []
        const artifacts =
          input.task.type === "coding"
            ? []
            : input.task.type === "article"
            ? [await files.saveArtifact(input.runId, "article.json", Buffer.from(JSON.stringify(mockArticleFromPrompt(input.task.prompt), null, 2)))]
            : [
                await files.saveArtifact(
                  input.runId,
                  "report.md",
                  Buffer.from(
                    `# Mock report (${label})\n\nInputs: ${attachments.map((a) => a.name).join(", ") || "none"}\n\nThis file was produced by the mock provider.\n`,
                  ),
                ),
              ]
        return {
          result: {
            artifacts,
            summary: "Added a homepage redirect for authenticated users and a regression test; all 13 tests pass.",
            changedFiles: ["src/middleware.ts", "src/middleware.test.ts"],
            testResult: "Passed: 13 passed",
            finalOutput:
              "I added a guard in src/middleware.ts that redirects authenticated users from / to /mypage, updated the test fixture so the session includes a user, and re-ran the suite: 13/13 passing.",
          },
          usage: { inputTokens: 48_200, outputTokens: 3_900 },
          costUsd: id === "openai" ? 0.68 : 0.44,
        }
      })()
      return {
        done,
        async cancel() {
          abort.abort()
        },
      }
    },
  }
}
