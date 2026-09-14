import { describe, expect, it } from "vitest"
import type OpenAI from "openai"
import { createOpenAINormalizer } from "./normalize"

type SessionEvent = OpenAI.Beta.Agents.AgentSessionEvent
type OutputItem = OpenAI.Beta.Agents.AgentOutputItem

const now = new Date("2026-09-14T00:00:00.000Z")

function itemAdded(item: OutputItem): SessionEvent {
  return {
    type: "agent.session.turn.item.added",
    event_id: "ev_a",
    item,
    output_index: 0,
    session_id: "sess_1",
    turn_id: "turn_1",
  } as SessionEvent
}

function itemDone(item: OutputItem): SessionEvent {
  return { ...(itemAdded(item) as object), type: "agent.session.turn.item.done" } as SessionEvent
}

function command(
  id: string,
  cmd: string,
  extra: Partial<OpenAI.Beta.Agents.AgentCommandExecutionItem> = {},
): OpenAI.Beta.Agents.AgentCommandExecutionItem {
  return {
    id,
    type: "command_execution",
    command: cmd,
    cwd: "/workspace",
    duration_ms: null,
    exit_code: null,
    output: null,
    status: "in_progress",
    turn_id: "turn_1",
    ...extra,
  }
}

describe("openai normalizer", () => {
  it("appends a shell event when a command starts and updates it when done", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    const added = normalize(itemAdded(command("cmd_1", "pnpm install")))
    expect(added).toEqual([
      {
        kind: "append",
        key: "cmd_1",
        event: {
          type: "shell",
          title: "pnpm install",
          detail: undefined,
          timestamp: now.toISOString(),
          metadata: { command: "pnpm install", cwd: "/workspace", status: "in_progress" },
        },
      },
    ])
    const done = normalize(
      itemDone(
        command("cmd_1", "pnpm install", {
          status: "completed",
          exit_code: 0,
          output: "Done in 2s",
          duration_ms: 2000,
        }),
      ),
    )
    expect(done).toEqual([
      {
        kind: "update",
        key: "cmd_1",
        patch: {
          detail: "Done in 2s",
          durationMs: 2000,
          metadata: {
            command: "pnpm install",
            cwd: "/workspace",
            status: "completed",
            exitCode: 0,
          },
        },
      },
    ])
  })

  it("appends when a done item was never seen as added", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    const actions = normalize(
      itemDone(command("cmd_9", "ls", { status: "completed", exit_code: 0, output: "a\nb" })),
    )
    expect(actions[0]).toMatchObject({ kind: "append", key: "cmd_9", event: { type: "search", detail: "a\nb" } })
  })

  it("classifies tests, marks failures, and emits retry on re-run", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    normalize(itemAdded(command("c1", "pnpm test")))
    const [done] = normalize(
      itemDone(command("c1", "pnpm test", { status: "completed", exit_code: 1, output: "1 failed" })),
    )
    expect(done).toMatchObject({ kind: "update", patch: { metadata: { status: "failed", exitCode: 1 } } })
    const again = normalize(itemAdded(command("c2", "pnpm test")))
    expect(again.map((a) => a.kind)).toEqual(["append", "append"])
    expect(again[0]).toMatchObject({ event: { type: "retry" } })
    expect(again[1]).toMatchObject({ event: { type: "test" } })
  })

  it("unwraps bash -lc wrappers and honours a failed status without exit code", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    const [added] = normalize(itemAdded(command("w1", "/bin/bash -lc 'cat README.md'")))
    expect(added).toMatchObject({ event: { type: "file_read", title: "cat README.md", metadata: { command: "cat README.md" } } })
    const [done] = normalize(
      itemDone(command("w1", "/bin/bash -lc 'cat README.md'", { status: "failed", output: "No such file" })),
    )
    expect(done).toMatchObject({ kind: "update", patch: { metadata: { status: "failed", exitCode: null } } })
  })

  it("maps apply_patch commands to file_write with paths", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    const body = "apply_patch <<'EOF'\n*** Begin Patch\n*** Update File: src/a.ts\n*** End Patch\nEOF"
    const [action] = normalize(itemAdded(command("p1", body)))
    expect(action).toMatchObject({
      event: { type: "file_write", title: "src/a.ts", metadata: { path: "src/a.ts", paths: ["src/a.ts"] } },
    })
  })

  it("maps reasoning, commentary and final answers", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    expect(
      normalize(
        itemDone({
          id: "r1",
          type: "reasoning",
          status: "completed",
          summary: [{ type: "summary_text", text: "Inspect middleware" }],
          turn_id: "turn_1",
        }),
      )[0],
    ).toMatchObject({ event: { type: "thinking", title: "Inspect middleware" } })

    expect(
      normalize(
        itemDone({
          id: "m1",
          type: "message",
          role: "assistant",
          phase: "commentary",
          status: "completed",
          content: [{ type: "output_text", text: "Looking at the auth flow now." }],
          turn_id: "turn_1",
        } as OutputItem),
      )[0],
    ).toMatchObject({ event: { type: "planning", title: "Looking at the auth flow now." } })

    const final = normalize(
      itemDone({
        id: "m2",
        type: "message",
        role: "assistant",
        phase: "final_answer",
        status: "completed",
        content: [{ type: "output_text", text: "Done. Redirect added." }],
        turn_id: "turn_1",
      } as OutputItem),
    )
    expect(final).toEqual([])
    expect(normalize.finalText()).toBe("Done. Redirect added.")
  })

  it("maps web search and subagent calls", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    expect(
      normalize(
        itemDone({
          id: "w1",
          type: "web_search_call",
          status: "completed",
          action: { type: "search", query: "neon pricing" },
          turn_id: "turn_1",
        } as OutputItem),
      )[0],
    ).toMatchObject({ event: { type: "search", title: "web_search neon pricing" } })
    expect(
      normalize(
        itemDone({
          id: "s1",
          type: "create_subagent_call",
          status: "completed",
          turn_id: "turn_1",
        } as OutputItem),
      )[0],
    ).toMatchObject({ event: { type: "tool_call", title: "create_subagent_call" } })
  })

  it("maps session and turn failures to error events", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    expect(
      normalize({
        type: "error",
        event_id: "e",
        session_id: "s",
        error: { type: "server_error", code: null, message: "boom", param: null },
      } as SessionEvent)[0],
    ).toMatchObject({ event: { type: "error", title: "boom" } })
    expect(
      normalize({
        type: "agent.session.environment.failed",
        event_id: "e",
        session_id: "s",
        turn_id: null,
        environment: { status: "failed" },
      } as SessionEvent)[0],
    ).toMatchObject({ event: { type: "error", title: "Environment failed" } })
  })

  it("ignores delta and lifecycle events", () => {
    const normalize = createOpenAINormalizer({ now: () => now })
    expect(
      normalize({ type: "agent.session.turn.output_text.delta", delta: "x" } as unknown as SessionEvent),
    ).toEqual([])
    expect(normalize({ type: "agent.session.in_progress" } as unknown as SessionEvent)).toEqual([])
  })
})
