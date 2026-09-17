import { describe, expect, it } from "vitest"
import type Anthropic from "@anthropic-ai/sdk"
import { createAnthropicNormalizer } from "./normalize"

type SessionEvent = Anthropic.Beta.Sessions.BetaManagedAgentsSessionEvent

const at = "2026-09-14T00:00:00.000Z"

function toolUse(
  id: string,
  name: string,
  input: Record<string, unknown>,
): SessionEvent {
  return { id, type: "agent.tool_use", name, input, processed_at: at } as SessionEvent
}

function toolResult(
  id: string,
  tool_use_id: string,
  text: string,
  is_error = false,
): SessionEvent {
  return {
    id,
    type: "agent.tool_result",
    tool_use_id,
    content: [{ type: "text", text }],
    is_error,
    processed_at: "2026-09-14T00:00:02.500Z",
  } as SessionEvent
}

describe("anthropic normalizer", () => {
  it("maps bash tool use to a shell event keyed by the source event id", () => {
    const normalize = createAnthropicNormalizer()
    const actions = normalize(toolUse("sevt_1", "bash", { command: "pnpm install" }))
    expect(actions).toEqual([
      {
        kind: "append",
        key: "sevt_1",
        event: {
          type: "shell",
          title: "pnpm install",
          detail: undefined,
          timestamp: at,
          metadata: { tool: "bash", command: "pnpm install", input: { command: "pnpm install" } },
        },
      },
    ])
  })

  it("maps read/write/edit/grep/glob/web tools", () => {
    const normalize = createAnthropicNormalizer()
    expect(normalize(toolUse("a", "read", { path: "src/a.ts" }))[0]).toMatchObject({
      event: { type: "file_read", title: "src/a.ts", metadata: { path: "src/a.ts" } },
    })
    expect(normalize(toolUse("b", "write", { path: "src/b.ts", content: "x" }))[0]).toMatchObject({
      event: { type: "file_write", title: "src/b.ts", metadata: { path: "src/b.ts" } },
    })
    expect(
      normalize(toolUse("c", "edit", { path: "src/c.ts", old_string: "a", new_string: "b" }))[0],
    ).toMatchObject({
      event: {
        type: "file_write",
        title: "src/c.ts",
        metadata: { path: "src/c.ts", oldString: "a", newString: "b" },
      },
    })
    expect(normalize(toolUse("d", "grep", { pattern: "getSession" }))[0]).toMatchObject({
      event: { type: "search", title: "grep getSession" },
    })
    expect(normalize(toolUse("e", "glob", { pattern: "**/*.ts" }))[0]).toMatchObject({
      event: { type: "search", title: "glob **/*.ts" },
    })
    expect(normalize(toolUse("f", "web_search", { query: "neon vs supabase" }))[0]).toMatchObject({
      event: { type: "search", title: "web_search neon vs supabase" },
    })
    expect(normalize(toolUse("g", "web_fetch", { url: "https://x.y" }))[0]).toMatchObject({
      event: { type: "search", title: "web_fetch https://x.y" },
    })
    expect(normalize(toolUse("h", "mystery", { a: 1 }))[0]).toMatchObject({
      event: { type: "tool_call", title: "mystery" },
    })
  })

  it("classifies test commands and merges results into the originating event", () => {
    const normalize = createAnthropicNormalizer()
    const [use] = normalize(toolUse("sevt_1", "bash", { command: "pnpm test" }))
    expect(use).toMatchObject({ kind: "append", event: { type: "test", title: "pnpm test" } })
    const actions = normalize(toolResult("sevt_2", "sevt_1", "12 passed, 1 failed", true))
    expect(actions).toEqual([
      {
        kind: "update",
        key: "sevt_1",
        patch: {
          detail: "12 passed, 1 failed",
          durationMs: 2500,
          metadata: { isError: true, status: "failed" },
        },
      },
    ])
  })

  it("emits a retry event when tests are re-run after a failure", () => {
    const normalize = createAnthropicNormalizer()
    normalize(toolUse("sevt_1", "bash", { command: "pnpm test" }))
    normalize(toolResult("sevt_2", "sevt_1", "1 failed", true))
    const actions = normalize(toolUse("sevt_3", "bash", { command: "pnpm test" }))
    expect(actions.map((a) => a.kind)).toEqual(["append", "append"])
    expect(actions[0]).toMatchObject({ event: { type: "retry", title: "Retrying tests" } })
    expect(actions[1]).toMatchObject({ event: { type: "test" } })
    // a successful run clears the retry state
    normalize(toolResult("sevt_4", "sevt_3", "13 passed"))
    expect(normalize(toolUse("sevt_5", "bash", { command: "pnpm test" }))).toHaveLength(1)
  })

  it("detects failed tests from output text even without is_error", () => {
    const normalize = createAnthropicNormalizer()
    normalize(toolUse("sevt_1", "bash", { command: "pnpm test" }))
    const [action] = normalize(toolResult("sevt_2", "sevt_1", "Tests: 1 failed, 12 passed"))
    expect(action).toMatchObject({ patch: { metadata: { status: "failed" } } })
  })

  it("maps thinking, messages, compaction, errors and rescheduling", () => {
    const normalize = createAnthropicNormalizer()
    expect(
      normalize({ id: "t", type: "agent.thinking", processed_at: at } as SessionEvent)[0],
    ).toMatchObject({ event: { type: "thinking", title: "Thinking" } })
    expect(
      normalize({
        id: "m",
        type: "agent.message",
        content: [{ type: "text", text: "I will inspect the middleware first." }],
        processed_at: at,
      } as SessionEvent)[0],
    ).toMatchObject({
      event: { type: "planning", title: "I will inspect the middleware first." },
    })
    expect(
      normalize({ id: "c", type: "agent.thread_context_compacted", processed_at: at } as SessionEvent)[0],
    ).toMatchObject({ event: { type: "warning", title: "Context compacted" } })
    expect(
      normalize({
        id: "e",
        type: "session.error",
        error: { type: "model_overloaded", message: "Overloaded" },
        processed_at: at,
      } as unknown as SessionEvent)[0],
    ).toMatchObject({ event: { type: "error", title: "Overloaded" } })
    expect(
      normalize({ id: "r", type: "session.status_rescheduled", processed_at: at } as SessionEvent)[0],
    ).toMatchObject({ event: { type: "retry", title: "Session rescheduled" } })
  })

  it("ignores status events", () => {
    const normalize = createAnthropicNormalizer()
    expect(normalize({ id: "s", type: "session.status_running", processed_at: at } as SessionEvent)).toEqual([])
  })

  it("shows a model request while the agent produces no other events", () => {
    const normalize = createAnthropicNormalizer()
    expect(
      normalize({ id: "req", type: "span.model_request_start", processed_at: at } as SessionEvent)[0],
    ).toMatchObject({
      kind: "append",
      key: "req",
      event: { type: "thinking", title: "Model request" },
    })
    expect(
      normalize({
        id: "end",
        type: "span.model_request_end",
        model_request_start_id: "req",
        processed_at: "2026-09-14T00:00:04.000Z",
      } as unknown as SessionEvent)[0],
    ).toEqual({ kind: "update", key: "req", patch: { durationMs: 4000 } })
    expect(normalize.modelRequestFailed()).toBe(false)
  })

  it("marks a failed model request instead of silently dropping it", () => {
    const normalize = createAnthropicNormalizer()
    normalize({ id: "req", type: "span.model_request_start", processed_at: at } as SessionEvent)
    const [action] = normalize({
      id: "end",
      type: "span.model_request_end",
      model_request_start_id: "req",
      is_error: true,
      processed_at: "2026-09-14T00:00:04.000Z",
    } as unknown as SessionEvent)

    expect(action).toMatchObject({
      kind: "update",
      key: "req",
      patch: { title: "Model request failed", metadata: { status: "failed" } },
    })
    expect(normalize.modelRequestFailed()).toBe(true)
  })

  it("truncates long message titles", () => {
    const normalize = createAnthropicNormalizer()
    const text = "x".repeat(300)
    const [action] = normalize({
      id: "m",
      type: "agent.message",
      content: [{ type: "text", text }],
      processed_at: at,
    } as SessionEvent)
    expect(action).toMatchObject({ kind: "append" })
    if (action.kind !== "append") throw new Error("expected append")
    expect(action.event.title.length).toBeLessThanOrEqual(120)
    expect(action.event.detail).toBe(text)
  })
})
