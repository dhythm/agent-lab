import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRunStore, type RunStore } from "./run-store"
import { createOrchestrator, type Orchestrator } from "./orchestrator"
import type {
  AgentProvider,
  ProviderRunHandle,
  ProviderRunInput,
  ProviderRunSink,
} from "./provider"
import type { AgentTask, ProviderId } from "./types"

const task: AgentTask = {
  id: "task_1",
  title: "Fix redirect",
  prompt: "Redirect logged-in users to /mypage",
  type: "coding",
  createdAt: "2026-09-14T00:00:00.000Z",
}

const seoTask: AgentTask = {
  id: "task_seo",
  title: "SEO",
  systemPrompt: "Return JSON only.",
  prompt: `### 提出されたSEO記事:
#### タイトル:
元タイトル
#### 内容:
[{"id":1,"heading":"概要","content":{"paragraphs":["本文。"]},"sections":[]}]
### クローリング記事（タイトル、内容、リンク）:
[]`,
  type: "seo-proofread",
  createdAt: "2026-09-14T00:00:00.000Z",
}

function fakeProvider(
  id: ProviderId,
  behavior: (input: ProviderRunInput, sink: ProviderRunSink) => ProviderRunHandle,
): AgentProvider {
  return {
    id,
    label: id,
    async startRun(input, sink) {
      return behavior(input, sink)
    },
  }
}

function succeeding(id: ProviderId): AgentProvider {
  return fakeProvider(id, (input, sink) => ({
    done: (async () => {
      await sink.setExternalId(`${id}-ext`)
      await sink.emit({
        type: "shell",
        title: "pnpm test",
        timestamp: new Date().toISOString(),
      })
      return {
        result: {
          summary: "done",
          changedFiles: ["src/a.ts"],
          finalOutput: "All good",
        },
        costUsd: 0.5,
        usage: { inputTokens: 100, outputTokens: 20 },
      }
    })(),
    cancel: async () => {},
  }))
}

function failing(id: ProviderId): AgentProvider {
  return fakeProvider(id, () => ({
    done: Promise.reject(new Error("boom")),
    cancel: async () => {},
  }))
}

function waitFor(store: RunStore, runId: string, status: string) {
  return new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe(runId, (msg) => {
      if (msg.kind === "run" && msg.run.status === status) {
        unsubscribe()
        resolve()
      }
    })
    void store.getRun(runId).then((run) => {
      if (run?.status === status) {
        unsubscribe()
        resolve()
      }
    })
  })
}

let dir: string
let store: RunStore
let orchestrator: Orchestrator

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "agent-lab-"))
  store = createRunStore({ dir })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("orchestrator", () => {
  it("runs each provider independently and records results", async () => {
    orchestrator = createOrchestrator({
      store,
      providers: [succeeding("openai"), succeeding("anthropic")],
    })
    const runs = await orchestrator.start(task, ["openai", "anthropic"])
    await Promise.all(runs.map((r) => waitFor(store, r.id, "completed")))
    for (const run of runs) {
      const saved = await store.getRun(run.id)
      expect(saved?.status).toBe("completed")
      expect(saved?.externalId).toBe(`${run.provider}-ext`)
      expect(saved?.result?.finalOutput).toBe("All good")
      expect(saved?.metrics?.estimatedCost).toBe(0.5)
      expect(saved?.metrics?.inputTokens).toBe(100)
      expect(saved?.metrics?.outputTokens).toBe(20)
      expect(saved?.startedAt).toBeDefined()
      expect(saved?.completedAt).toBeDefined()
    }
  })

  it("keeps the other provider running when one fails", async () => {
    orchestrator = createOrchestrator({
      store,
      providers: [failing("openai"), succeeding("anthropic")],
    })
    const runs = await orchestrator.start(task, ["openai", "anthropic"])
    const openai = runs.find((r) => r.provider === "openai")!
    const anthropic = runs.find((r) => r.provider === "anthropic")!
    await Promise.all([
      waitFor(store, openai.id, "failed"),
      waitFor(store, anthropic.id, "completed"),
    ])
    const failed = await store.getRun(openai.id)
    expect(failed?.error).toBe("boom")
    expect(failed?.events.at(-1)?.type).toBe("error")
  })

  it("canonicalizes valid SEO JSON and records validation", async () => {
    const provider = fakeProvider("openai", () => ({
      done: Promise.resolve({
        result: {
          summary: "done",
          changedFiles: [],
          finalOutput: `{
            "contents": [{"id": 1, "heading": "概要", "content": {"paragraphs": ["本文。"]}, "sections": []}],
            "title": "元タイトル"
          }`,
        },
      }),
      cancel: async () => {},
    }))
    orchestrator = createOrchestrator({ store, providers: [provider] })
    const [run] = await orchestrator.start(seoTask, ["openai"])
    await waitFor(store, run.id, "completed")

    const saved = await store.getRun(run.id)
    expect(saved?.result?.outputValidation).toEqual({ valid: true })
    expect(saved?.result?.finalOutput).toBe(
      '{"contents":[{"id":1,"heading":"概要","content":{"paragraphs":["本文。"]},"sections":[]}],"title":"元タイトル"}',
    )
  })

  it("fails an SEO run whose final output is not valid JSON", async () => {
    const provider = fakeProvider("openai", () => ({
      done: Promise.resolve({
        result: { summary: "done", changedFiles: [], finalOutput: "not json" },
      }),
      cancel: async () => {},
    }))
    orchestrator = createOrchestrator({ store, providers: [provider] })
    const [run] = await orchestrator.start(seoTask, ["openai"])
    await waitFor(store, run.id, "failed")

    const saved = await store.getRun(run.id)
    expect(saved?.result?.outputValidation?.valid).toBe(false)
    expect(saved?.error).toMatch(/JSON/)
  })

  it("marks a run failed when the provider is not configured", async () => {
    orchestrator = createOrchestrator({ store, providers: [succeeding("anthropic")] })
    const runs = await orchestrator.start(task, ["openai"])
    await waitFor(store, runs[0].id, "failed")
    const saved = await store.getRun(runs[0].id)
    expect(saved?.error).toMatch(/not configured/i)
  })

  it("cancels a running provider", async () => {
    let cancelled = false
    let release: () => void = () => {}
    const blocked = fakeProvider("openai", () => ({
      done: new Promise((_, reject) => {
        release = () => reject(new Error("interrupted"))
      }),
      cancel: async () => {
        cancelled = true
        release()
      },
    }))
    orchestrator = createOrchestrator({ store, providers: [blocked] })
    const runs = await orchestrator.start(task, ["openai"])
    await waitFor(store, runs[0].id, "running")
    await orchestrator.cancel(runs[0].id)
    await waitFor(store, runs[0].id, "cancelled")
    expect(cancelled).toBe(true)
    const saved = await store.getRun(runs[0].id)
    expect(saved?.status).toBe("cancelled")
  })
})
