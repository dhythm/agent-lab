import { describe, expect, it } from "vitest"
import { writeArticle, type StructuredCompleter, type CompletionRequest } from "./write-article"

const input = {
  direction: "方向性",
  seoKeywords: "AI,評価,倫理,構成",
  coreKeyword: "AI,評価,倫理",
  topicKeyword: "構成",
  title: "タイトル",
  chapters: "H2 [c1] この記事のまとめ (targetCharCount: 280)\nH2 [c2] 章 (targetCharCount: 500)",
  references: "[1] 資料",
}

const article = {
  title: "タイトル",
  contents: [
    { id: 1, heading: "この記事のまとめ", content: { paragraphs: ["あ".repeat(280)] }, sections: [] },
    { id: 2, heading: "章", content: { paragraphs: ["い".repeat(200)] }, sections: [] },
  ],
}

function fakeCompleter(replies: string[]): StructuredCompleter & { requests: CompletionRequest[] } {
  const requests: CompletionRequest[] = []
  return {
    id: "fake",
    model: "fake-model",
    requests,
    async complete(request) {
      requests.push(request)
      const text = replies.shift()
      if (text === undefined) throw new Error("no more replies")
      return { text, usage: { inputTokens: 10, outputTokens: 5 } }
    },
  }
}

describe("writeArticle", () => {
  it("renders the system prompt, sends the XML user message and returns the parsed article", async () => {
    const completer = fakeCompleter([JSON.stringify(article)])
    const result = await writeArticle(input, completer)
    expect(result.article.title).toBe("タイトル")
    expect(result.attempts).toBe(1)
    expect(completer.requests[0].system).toContain("「AI,評価,倫理」における「構成」")
    expect(completer.requests[0].messages[0].content).toContain("<title>\nタイトル\n</title>")
    expect(completer.requests[0].schema).toBeDefined()
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 })
  })

  it("retries once with the validation errors when the reply is not a valid article", async () => {
    const completer = fakeCompleter(["{broken", JSON.stringify(article)])
    const result = await writeArticle(input, completer)
    expect(result.attempts).toBe(2)
    const retry = completer.requests[1].messages
    expect(retry).toHaveLength(3)
    expect(retry[1]).toEqual({ role: "assistant", content: "{broken" })
    expect(retry[2].content).toMatch(/JSON/)
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 })
  })

  it("throws with the last errors when the retry also fails", async () => {
    const completer = fakeCompleter(["{broken", "[]"])
    await expect(writeArticle(input, completer)).rejects.toThrow(/valid article/)
  })

  it("reports chapter lengths against targetCharCount from the chapters text", async () => {
    const completer = fakeCompleter([JSON.stringify(article)])
    const result = await writeArticle(input, completer)
    expect(result.lengthReport).toEqual([
      { heading: "この記事のまとめ", targetCharCount: 280, actualCharCount: 280, status: "ok" },
      { heading: "章", targetCharCount: 500, actualCharCount: 200, status: "short" },
    ])
  })
})
