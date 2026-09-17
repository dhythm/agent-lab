import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { createFileStore, type FileStore } from "@/lib/agent-lab/files"
import type { AgentProvider, ProviderRunHandle, ProviderRunInput, ProviderRunOutcome, ProviderRunSink } from "@/lib/agent-lab/provider"
import type { AgentEvent, AgentTask, NewAgentEvent } from "@/lib/agent-lab/types"
import { ARTICLE_TASK_TEMPLATE } from "@/lib/article-writer/template"
import { createArticleProvider, readArticleInput, renderArticleTask } from "./provider"

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
      events[idx] = { ...events[idx], ...patch }
      return events[idx]
    },
    async setExternalId() {},
  }
  return { sink, events }
}

interface FakeBase extends AgentProvider {
  received: ProviderRunInput[]
  cancelled: boolean
}

function fakeBase(files: FileStore, produce: (input: ProviderRunInput) => Promise<Partial<ProviderRunOutcome["result"]>>): FakeBase {
  const base: FakeBase = {
    id: "openai",
    label: "base",
    received: [],
    cancelled: false,
    async startRun(input): Promise<ProviderRunHandle> {
      base.received.push(input)
      const done = (async (): Promise<ProviderRunOutcome> => {
        const partial = await produce(input)
        return { result: { summary: "base summary", changedFiles: [], finalOutput: "base output", ...partial }, usage: { inputTokens: 5, outputTokens: 7 } }
      })()
      return { done, async cancel() { base.cancelled = true } }
    },
  }
  void files
  return base
}

let files: FileStore
let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "article-provider-"))
  files = createFileStore(dir)
})

async function articleTask(input: unknown, prompt = ARTICLE_TASK_TEMPLATE): Promise<AgentTask> {
  const stored = path.join(dir, "article-input.json")
  await writeFile(stored, JSON.stringify(input))
  return { id: "task", title: "t", prompt, type: "article", attachments: [{ name: "article-input.json", size: 1, storedPath: stored }], createdAt: "" }
}

describe("readArticleInput", () => {
  it("reads the input from the JSON attachment, accepting the outline form", async () => {
    const task = await articleTask({
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

  it("explains what is missing when there is no JSON attachment", async () => {
    const task: AgentTask = { id: "t", title: "t", prompt: "x", type: "article", createdAt: "" }
    await expect(readArticleInput(task)).rejects.toThrow(/article-input\.json/)
  })
})

describe("renderArticleTask", () => {
  it("fills every placeholder of the task template from the input", () => {
    const rendered = renderArticleTask(ARTICLE_TASK_TEMPLATE, articleInput)
    expect(rendered).toContain("「AI,評価,倫理,構成」を扱う専門ライター")
    expect(rendered).toContain("「AI,評価,倫理」における「構成」")
    expect(rendered).toContain("文体：「です・ます調」")
    expect(rendered).toContain("### タイトル:\nタイトル\n")
    expect(rendered).toContain("H2 [c2] 章 (targetCharCount: 500)")
    expect(rendered).not.toMatch(/\{\{/)
  })

  it("rejects placeholders the input cannot fill", () => {
    expect(() => renderArticleTask("{{ title }} {{ unknownThing }}", articleInput)).toThrow(/unknownThing/)
  })
})

describe("createArticleProvider", () => {
  it("delegates non-article tasks to the wrapped provider unchanged", async () => {
    const base = fakeBase(files, async () => ({}))
    const provider = createArticleProvider(base, files)
    const task = { ...(await articleTask(articleInput)), type: "coding" as const }
    const handle = await provider.startRun({ runId: "run", task }, fakeSink().sink)
    expect((await handle.done).result.summary).toBe("base summary")
    expect(base.received[0].task.prompt).toBe(task.prompt)
  })

  it("sends a filled system prompt and user input to the agent and validates article.json", async () => {
    const base = fakeBase(files, async (input) => ({
      artifacts: [await files.saveArtifact(input.runId, "article.json", Buffer.from(JSON.stringify(article)))],
    }))
    const provider = createArticleProvider(base, files)
    const { sink, events } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await articleTask(articleInput) }, sink)
    const outcome = await handle.done

    const sent = base.received[0].task
    expect(sent.systemPrompt).toContain("「AI,評価,倫理,構成」を扱う専門ライター")
    expect(sent.systemPrompt).not.toContain("## 入力文:")
    expect(sent.systemPrompt).not.toMatch(/\{\{/)
    expect(sent.prompt.startsWith("## 入力文:")).toBe(true)
    expect(sent.prompt).toContain("### タイトル:\nタイトル\n")
    expect(sent.prompt).not.toContain("## 役割")
    expect(sent.prompt).not.toMatch(/\{\{/)
    expect(sent.prompt).toContain("article.json")
    expect(sent.prompt).toContain('"contents"')
    expect(events.map((e) => e.type)).toEqual(["planning", "success"])
    expect(events[1].detail).toContain("この記事のまとめ")
    expect(outcome.result.testResult).toMatch(/passed/)
    expect(outcome.result.summary).toMatch(/2 chapters/)
    expect(outcome.result.changedFiles).toContain("article.json")
    expect(outcome.usage).toEqual({ inputTokens: 5, outputTokens: 7 })
  })

  it("falls back to the final output when the agent returned the JSON as its answer", async () => {
    const base = fakeBase(files, async () => ({ finalOutput: "```json\n" + JSON.stringify(article) + "\n```" }))
    const provider = createArticleProvider(base, files)
    const { sink } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await articleTask(articleInput) }, sink)
    const outcome = await handle.done
    expect(outcome.result.testResult).toMatch(/passed/)
    expect(outcome.result.artifacts?.map((a) => a.name)).toEqual(["article.json"])
  })

  it("keeps the run but flags the schema violations when the JSON is invalid", async () => {
    const base = fakeBase(files, async (input) => ({
      artifacts: [await files.saveArtifact(input.runId, "article.json", Buffer.from('{"title": 1}'))],
    }))
    const provider = createArticleProvider(base, files)
    const { sink, events } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await articleTask(articleInput) }, sink)
    const outcome = await handle.done
    expect(events.map((e) => e.type)).toEqual(["planning", "warning"])
    expect(events[1].detail).toMatch(/title/)
    expect(outcome.result.testResult).toMatch(/failed/)
  })

  it("passes an already filled user prompt through without the system section", async () => {
    const base = fakeBase(files, async () => ({ finalOutput: JSON.stringify(article) }))
    const provider = createArticleProvider(base, files)
    const userPrompt = "## 入力文:\n### タイトル:\n編集済みタイトル"
    const handle = await provider.startRun(
      { runId: "run", task: await articleTask(articleInput, userPrompt) },
      fakeSink().sink,
    )
    await handle.done
    expect(base.received[0].task.prompt.startsWith("## 入力文:")).toBe(true)
    expect(base.received[0].task.prompt).toContain("編集済みタイトル")
    expect(base.received[0].task.systemPrompt).toContain("専門ライター")
  })

  it("fails before calling the agent when the input cannot fill the template", async () => {
    const base = fakeBase(files, async () => ({}))
    const provider = createArticleProvider(base, files)
    const { sink, events } = fakeSink()
    const handle = await provider.startRun({ runId: "run", task: await articleTask({ title: "only" }) }, sink)
    await expect(handle.done).rejects.toThrow(/seoKeywords/)
    expect(events.some((e) => e.type === "error")).toBe(true)
    expect(base.received).toHaveLength(0)
  })

  it("forwards cancel to the wrapped provider", async () => {
    let release: () => void = () => {}
    const base = fakeBase(files, () => new Promise((resolve) => { release = () => resolve({}) }))
    const provider = createArticleProvider(base, files)
    const handle = await provider.startRun({ runId: "run", task: await articleTask(articleInput) }, fakeSink().sink)
    await handle.cancel()
    expect(base.cancelled).toBe(true)
    release()
    await handle.done
  })
})
