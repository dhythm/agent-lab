import { describe, expect, it, vi } from "vitest"
import { createActionApplier } from "./apply-actions"
import type { ProviderRunSink } from "@/lib/agent-lab/provider"
import type { AgentEvent } from "@/lib/agent-lab/types"

function fakeSink() {
  let counter = 0
  const sink: ProviderRunSink = {
    emit: vi.fn(async (event) => {
      counter += 1
      return { ...event, id: `evt_${counter}`, runId: "run", provider: "openai" } as AgentEvent
    }),
    updateEvent: vi.fn(async (eventId, patch) => ({ id: eventId, ...patch }) as AgentEvent),
    setExternalId: vi.fn(async () => {}),
  }
  return sink
}

describe("createActionApplier", () => {
  it("appends events and resolves later updates to the stored event id", async () => {
    const sink = fakeSink()
    const apply = createActionApplier(sink)
    await apply([
      { kind: "append", key: "a", event: { type: "shell", title: "ls", timestamp: "t" } },
    ])
    await apply([{ kind: "update", key: "a", patch: { detail: "out" } }])
    expect(sink.updateEvent).toHaveBeenCalledWith("evt_1", { detail: "out" })
  })

  it("merges metadata on update instead of replacing it", async () => {
    const sink = fakeSink()
    const apply = createActionApplier(sink)
    await apply([
      {
        kind: "append",
        key: "a",
        event: { type: "shell", title: "ls", timestamp: "t", metadata: { command: "ls" } },
      },
    ])
    await apply([{ kind: "update", key: "a", patch: { metadata: { exitCode: 0 } } }])
    expect(sink.updateEvent).toHaveBeenCalledWith("evt_1", {
      metadata: { command: "ls", exitCode: 0 },
    })
  })

  it("ignores updates for unknown keys", async () => {
    const sink = fakeSink()
    const apply = createActionApplier(sink)
    await apply([{ kind: "update", key: "missing", patch: { detail: "x" } }])
    expect(sink.updateEvent).not.toHaveBeenCalled()
  })
})
