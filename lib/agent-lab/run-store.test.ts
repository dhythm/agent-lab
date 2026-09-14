import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRunStore, type RunStore } from "./run-store"
import type { AgentTask } from "./types"

const task: AgentTask = {
  id: "task_1",
  title: "Fix redirect",
  prompt: "Redirect logged-in users to /mypage",
  type: "coding",
  repository: "owner/repo",
  branch: "main",
  createdAt: "2026-09-14T00:00:00.000Z",
}

let dir: string
let store: RunStore

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "agent-lab-"))
  store = createRunStore({ dir })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("run store", () => {
  it("creates a task with runs per provider", async () => {
    const { task: saved, runs } = await store.createTaskRuns(task, [
      "openai",
      "anthropic",
    ])
    expect(saved.id).toBe("task_1")
    expect(runs.map((r) => r.provider)).toEqual(["openai", "anthropic"])
    expect(runs.every((r) => r.status === "queued")).toBe(true)
    expect(runs.every((r) => r.taskId === "task_1")).toBe(true)
  })

  it("appends events and assigns ids", async () => {
    const { runs } = await store.createTaskRuns(task, ["anthropic"])
    const runId = runs[0].id
    const ev = await store.appendEvent(runId, {
      type: "shell",
      title: "pnpm test",
      timestamp: "2026-09-14T00:00:01.000Z",
    })
    expect(ev.id).toMatch(/^evt_/)
    expect(ev.runId).toBe(runId)
    expect(ev.provider).toBe("anthropic")
    const run = await store.getRun(runId)
    expect(run?.events).toHaveLength(1)
  })

  it("updates an existing event in place", async () => {
    const { runs } = await store.createTaskRuns(task, ["anthropic"])
    const runId = runs[0].id
    const ev = await store.appendEvent(runId, {
      type: "shell",
      title: "pnpm test",
      timestamp: "2026-09-14T00:00:01.000Z",
    })
    const updated = await store.updateEvent(runId, ev.id, {
      detail: "13 passed",
      durationMs: 8400,
      metadata: { exitCode: 0 },
    })
    expect(updated.detail).toBe("13 passed")
    expect(updated.durationMs).toBe(8400)
    const run = await store.getRun(runId)
    expect(run?.events[0].metadata).toEqual({ exitCode: 0 })
    await expect(store.updateEvent(runId, "evt_missing", {})).rejects.toThrow(/not found/i)
  })

  it("updates run status and recomputes metrics", async () => {
    const { runs } = await store.createTaskRuns(task, ["openai"])
    const runId = runs[0].id
    await store.updateRun(runId, {
      status: "running",
      startedAt: "2026-09-14T00:00:00.000Z",
    })
    await store.appendEvent(runId, {
      type: "shell",
      title: "ls",
      timestamp: "2026-09-14T00:00:01.000Z",
    })
    await store.updateRun(runId, {
      status: "completed",
      completedAt: "2026-09-14T00:00:10.000Z",
    })
    const run = await store.getRun(runId)
    expect(run?.status).toBe("completed")
    expect(run?.metrics?.toolCalls).toBe(1)
    expect(run?.metrics?.durationMs).toBe(10_000)
  })

  it("notifies subscribers of events and run updates", async () => {
    const { runs } = await store.createTaskRuns(task, ["openai"])
    const runId = runs[0].id
    const received: string[] = []
    const unsubscribe = store.subscribe(runId, (msg) => {
      received.push(msg.kind)
    })
    await store.appendEvent(runId, {
      type: "planning",
      title: "plan",
      timestamp: "2026-09-14T00:00:01.000Z",
    })
    await store.updateRun(runId, { status: "running" })
    const run = (await store.getRun(runId))!
    await store.updateEvent(runId, run.events[0].id, { detail: "x" })
    unsubscribe()
    await store.updateRun(runId, { status: "completed" })
    expect(received).toEqual(["event", "run", "event"])
  })

  it("persists to disk and reloads in a new store instance", async () => {
    const { runs } = await store.createTaskRuns(task, ["anthropic"])
    await store.appendEvent(runs[0].id, {
      type: "planning",
      title: "plan",
      timestamp: "2026-09-14T00:00:01.000Z",
    })
    const reloaded = createRunStore({ dir })
    const run = await reloaded.getRun(runs[0].id)
    expect(run?.events).toHaveLength(1)
    const tasks = await reloaded.listTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].runs[0].id).toBe(runs[0].id)
  })

  it("lists tasks newest first", async () => {
    await store.createTaskRuns({ ...task, id: "task_a", createdAt: "2026-09-14T00:00:00.000Z" }, ["openai"])
    await store.createTaskRuns({ ...task, id: "task_b", createdAt: "2026-09-14T01:00:00.000Z" }, ["openai"])
    const tasks = await store.listTasks()
    expect(tasks.map((t) => t.task.id)).toEqual(["task_b", "task_a"])
  })

  it("stores evaluation scores per run", async () => {
    const { runs } = await store.createTaskRuns(task, ["openai"])
    await store.saveEvaluation(runs[0].id, {
      taskCompletion: 5,
      speed: 4,
      costEfficiency: 3,
      toolEfficiency: 4,
      recovery: 5,
      codeQuality: 4,
    })
    const tasks = await store.listTasks()
    expect(tasks[0].evaluations[runs[0].id]?.speed).toBe(4)
  })
})
