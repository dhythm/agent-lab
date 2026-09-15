import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { createFileStore, type FileStore } from "@/lib/agent-lab/files"
import type { AgentProvider, ProviderRunSink, ProviderRunHandle } from "@/lib/agent-lab/provider"
import type { AgentEvent, AgentTask, NewAgentEvent } from "@/lib/agent-lab/types"
import type { CompletionRequest, StructuredCompleter } from "@/lib/article-writer/write-article"
import { createArticleProvider, readArticleInput } from "./provider"

const article = {
  title: "タイトル",
  contents: [
    { id: 1, heading: "この記事のまとめ", content: { paragraphs: ["あ".repeat(280)] }, sections: [] },
    { id: 2, heading: "章", content: { paragraphs: ["い".repeat(500)] }, sections: [] },
  ],
}

const articleInput = {
  title: "タイトル",
  seoKeywords: "AI,評価,倫理,構成",
  coreKeyword: "AI,評価,倫理",
  topicKeyword: "構成",
  direction: "方向性",
  chapters: "H2 [c1] この記事のまとめ (targetCharCount: 280)\nH2 [c2] 章 (targetCharCount: 500)",
  references: "[1] 資料",
}

function fakeCompleter(replies: string[]): StructuredCompleter & { requests: CompletionRequest[] } {
  const requests: CompletionRequest[] = []
  return {
    id: "openai",
    model: "fake",
    requests,
    async complete(request) {
      requests.push(request)
      const text = replies.shift()
      if (text === undefined) throw new Error("no replies left")
      return { text, usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 10 } }
    },
  }
}

function fakeSink() {
  const events: AgentEvent[] = []
  let n = 0
  const sink: ProviderRunSink = {
    async emit(event: NewAgentEvent) {
      const stored = { ...event, id: `e${++n}`, runId: "run", provider: "openai" as const }
      events.push(stored)
      return stored
    },
    async updateEvent(id, patch) {
      const idx = events.findIndex((e) => e.id === id)
      events[idx] = { ...events[idx], ...patch, metadata: { ...events[idx].metadata, ...patch.metadata } }
      return events[idx]
    },
    async setExternalId() {},
  }
  return { sink, events }
}

const base: AgentProvider = {
  id: "openai",
  label: "base",
  async startRun(): Promise<ProviderRunHandle> {
    return { done: Promise.resolve({ result: { summary: "base", changedFiles: [], finalOutput: "base" } }), async cancel() {} }
  },
}

let files: FileStore
let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "article-provider-"))
  files = createFileStore(dir)
})

async function taskWithInput(input: unknown): Promise<AgentTask> {
  const stored = path.join(dir, "article-input.json")
  await writeFile(stored, JSON.stringify(input))
  return {
    id: "task",
    title: "t",
    prompt: "記事本文を生成してください。",
    type: "article",
    attachments: [{ name: "article-input.json", size: 1, storedPath: stored }],
    createdAt: new Date().toISOString(),
  }
}

describe("readArticleInput", () => {
  it("reads the input from the JSON attachment, accepting the outline form", async () => {
    const task = await taskWithInput({
      title: "T",
      seoKeywords: "a,b",
      outline: {
        direction: "d",
        chapters: [{ id: "c1", title: "この記事のまとめ", targetCharCount: 280, sections: [] }],
        references: [{ id: "r1", chapterId: "c1", sectionId: null, title: "x", url: "https://x", excerpt: "e" }],
      },
    })
    const input = await readArticleInput(task)
    expect(input.chapters).toContain("H2 [c1] この記事のまとめ (targetCharCount: 280)")
    expect(input.references).toContain("[1] x")
  })

  it("falls back to the task prompt when it is JSON and there is no attachment", async () => {
    const task: AgentTask = { id: "t", title: "t", prompt: JSON.stringify(articleInput), type: "article", createdAt: "" }
    expect((await readArticleInput(task)).title).toBe("タイトル")
  })

  it("explains what is missing when no input can be found", async () => {
    const task: AgentTask = { id: "t", title: "t", prompt: "free text", type: "article", createdAt: "" }
    await expect(readArticleInput(task)).rejects.toThrow(/article-input\.json/)
  })
})

describe("createArticleProvider", () => {
  it("delegates non-article tasks to the wrapped provider", async () => {
    const provider = createArticleProvider(base, () => fakeCompleter([]), files)
    const { sink } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: { ...(await taskWithInput(articleInput)), type: "coding" } }, sink)
    expect((await handle.done).result.summary).toBe("base")
  })

  it("runs the structured-output flow, records the timeline and saves article.json", async () => {
    const completer = fakeCompleter([JSON.stringify(article)])
    const provider = createArticleProvider(base, () => completer, files)
    const { sink, events } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await taskWithInput(articleInput) }, sink)
    const outcome = await handle.done

    expect(events.map((e) => e.type)).toEqual(["planning", "tool_call", "file_write", "success"])
    expect(events[1].metadata?.status).toBe("completed")
    expect(outcome.result.artifacts?.map((a) => a.name)).toEqual(["article.json"])
    expect(outcome.result.changedFiles).toEqual(["article.json"])
    expect(outcome.usage).toEqual({ inputTokens: 100, outputTokens: 50, cachedInputTokens: 10 })
    expect(outcome.result.finalOutput).toContain("この記事のまとめ")
    expect(outcome.result.summary).toMatch(/2 chapters/)
  })

  it("shows the retry in the timeline when the first reply is invalid", async () => {
    const completer = fakeCompleter(["{broken", JSON.stringify(article)])
    const provider = createArticleProvider(base, () => completer, files)
    const { sink, events } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await taskWithInput(articleInput) }, sink)
    await handle.done
    const types = events.map((e) => e.type)
    expect(types).toEqual(["planning", "tool_call", "retry", "tool_call", "file_write", "success"])
    expect(events[2].detail).toMatch(/Invalid JSON/)
    expect(events[1].metadata?.status).toBe("failed")
  })

  it("fails the run with a clear error when the input attachment is invalid", async () => {
    const provider = createArticleProvider(base, () => fakeCompleter([]), files)
    const { sink, events } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await taskWithInput({ title: "only" }) }, sink)
    await expect(handle.done).rejects.toThrow(/seoKeywords/)
    expect(events.some((e) => e.type === "error")).toBe(true)
  })

  it("passes the abort signal so cancel stops the request", async () => {
    let seen: AbortSignal | undefined
    const completer: StructuredCompleter = {
      id: "openai",
      model: "fake",
      async complete(request) {
        seen = request.signal
        return new Promise((_, reject) => {
          if (request.signal?.aborted) return reject(new Error("aborted"))
          request.signal?.addEventListener("abort", () => reject(new Error("aborted")))
        })
      },
    }
    const provider = createArticleProvider(base, () => completer, files)
    const { sink } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await taskWithInput(articleInput) }, sink)
    await handle.cancel()
    await expect(handle.done).rejects.toThrow(/aborted/)
    expect(seen?.aborted).toBe(true)
  })
})
