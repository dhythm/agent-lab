import { describe, expect, it } from "vitest"
import { computeMetrics } from "./metrics"
import type { AgentEvent, AgentRun } from "./types"

function event(partial: Partial<AgentEvent> & { type: AgentEvent["type"] }): AgentEvent {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    runId: "run_1",
    provider: "anthropic",
    title: partial.title ?? partial.type,
    timestamp: partial.timestamp ?? "2026-09-14T00:00:00.000Z",
    ...partial,
  }
}

function run(events: AgentEvent[], extra: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "run_1",
    taskId: "task_1",
    provider: "anthropic",
    status: "completed",
    events,
    ...extra,
  }
}

describe("computeMetrics", () => {
  it("returns empty metrics for a run without events", () => {
    expect(computeMetrics(run([]))).toEqual({
      durationMs: undefined,
      steps: 0,
      toolCalls: 0,
      filesChanged: 0,
      retries: 0,
      inputTokens: undefined,
      outputTokens: undefined,
      estimatedCost: undefined,
    })
  })

  it("counts tool calls, retries and steps from events", () => {
    const metrics = computeMetrics(
      run([
        event({ type: "planning" }),
        event({ type: "shell" }),
        event({ type: "file_read" }),
        event({ type: "search" }),
        event({ type: "retry" }),
        event({ type: "final_output" }),
      ]),
    )
    expect(metrics.steps).toBe(6)
    expect(metrics.toolCalls).toBe(3)
    expect(metrics.retries).toBe(1)
  })

  it("counts distinct written files", () => {
    const metrics = computeMetrics(
      run([
        event({ type: "file_write", metadata: { path: "src/a.ts" } }),
        event({ type: "file_write", metadata: { path: "src/a.ts" } }),
        event({ type: "file_write", metadata: { path: "src/b.ts" } }),
        event({ type: "file_write" }),
      ]),
    )
    expect(metrics.filesChanged).toBe(2)
    expect(metrics.toolCalls).toBe(4)
  })

  it("derives duration from startedAt and completedAt", () => {
    const metrics = computeMetrics(
      run([], {
        startedAt: "2026-09-14T00:00:00.000Z",
        completedAt: "2026-09-14T00:01:30.000Z",
      }),
    )
    expect(metrics.durationMs).toBe(90_000)
  })

  it("sums usage metadata across events", () => {
    const metrics = computeMetrics(
      run([
        event({
          type: "tool_call",
          metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
        }),
        event({
          type: "tool_call",
          metadata: { usage: { inputTokens: 20, outputTokens: 7 } },
        }),
      ]),
    )
    expect(metrics.inputTokens).toBe(30)
    expect(metrics.outputTokens).toBe(12)
  })

  it("uses a cost provided in metadata when present", () => {
    const metrics = computeMetrics(
      run([event({ type: "success", metadata: { costUsd: 0.42 } })]),
    )
    expect(metrics.estimatedCost).toBe(0.42)
  })
})
