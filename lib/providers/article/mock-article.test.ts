import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createFileStore } from "@/lib/agent-lab/files"
import type { ProviderRunSink } from "@/lib/agent-lab/provider"
import { ARTICLE_TASK_TEMPLATE } from "@/lib/article-writer/template"
import { createMockProvider } from "@/lib/providers/mock/provider"
import { createArticleProvider } from "./provider"
import { mockArticleFromPrompt } from "./mock-article"

const sink: ProviderRunSink = {
  async emit(event) { return { ...event, id: "e", runId: "r", provider: "openai" } },
  async updateEvent(id, patch) { return { id, runId: "r", provider: "openai", type: "thinking", title: "", timestamp: "", ...patch } },
  async setExternalId() {},
}

describe("mock article generation through the article wrapper", () => {
  it("produces one chapter per H2 and one section per H3 from the rendered prompt", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mock-article-"))
    const files = createFileStore(dir)
    const stored = path.join(dir, "article-input.json")
    await writeFile(stored, JSON.stringify({
      title: "T", seoKeywords: "a,b", direction: "d",
      chapters: "H2 [c1] この記事のまとめ (targetCharCount: 280)\nH2 [c2] 章 (targetCharCount: 0)\n  H3 [s1] 節 (targetCharCount: 400)",
      references: "[1] x",
    }))
    const provider = createArticleProvider(createMockProvider("openai", "mock", files), files)
    const handle = await provider.startRun(
      { runId: "run", task: { id: "t", title: "t", prompt: ARTICLE_TASK_TEMPLATE, type: "article", attachments: [{ name: "article-input.json", size: 1, storedPath: stored }], createdAt: "" } },
      sink,
    )
    const outcome = await handle.done
    expect(outcome.result.testResult).toMatch(/passed/)
    expect(outcome.result.summary).toMatch(/2 chapters, 1 sections/)
  }, 30_000)

  it("handles a prompt without the input block gracefully", () => {
    expect(mockArticleFromPrompt("nothing here")).toEqual({ title: "Mock article", contents: [] })
  })
})

describe("mockArticleFromPrompt with CRLF line endings", () => {
  it("still finds the title and chapters", () => {
    const prompt = "### タイトル:\r\nT\r\n\r\n### 章立てと目安となる文字数:\r\nH2 [c1] 章 (targetCharCount: 100)\r\n\r\n### 参照\r\n"
    const article = mockArticleFromPrompt(prompt)
    expect(article.title).toBe("T")
    expect(article.contents).toHaveLength(1)
  })
})
