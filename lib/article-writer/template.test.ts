import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { articleInputSchema, toArticleInput } from "./input-schema"
import {
  ARTICLE_SYSTEM_TEMPLATE,
  articleUserPromptFromTask,
  renderArticleUserPrompt,
  renderSystemPrompt,
  renderTemplate,
} from "./template"

describe("renderTemplate", () => {
  it("replaces {{var}} and {{ var }} placeholders", () => {
    expect(renderTemplate("a {{x}} b {{ y }}", { x: "1", y: "2" })).toBe("a 1 b 2")
  })

  it("throws when a placeholder has no value", () => {
    expect(() => renderTemplate("{{x}} {{missing}}", { x: "1" })).toThrow(/missing/)
  })
})

describe("renderSystemPrompt", () => {
  it("fills the article template with required variables and empty optional blocks", () => {
    const prompt = renderSystemPrompt({
      seoKeywords: "AI,評価,倫理,構成",
      coreKeyword: "AI,評価,倫理",
      topicKeyword: "構成",
    })
    expect(prompt).toContain("「AI,評価,倫理,構成」を扱う専門ライター")
    expect(prompt).toContain("「AI,評価,倫理」における「構成」")
    expect(prompt).toContain("文体：「です・ます調」")
    expect(prompt).not.toMatch(/\{\{/)
  })

  it("rejects missing required variables", () => {
    expect(() => renderSystemPrompt({ seoKeywords: "a", coreKeyword: "", topicKeyword: "b" })).toThrow(/coreKeyword/)
  })

  it("keeps the template free of unknown placeholders", () => {
    const names = [...ARTICLE_SYSTEM_TEMPLATE.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])
    expect(new Set(names)).toEqual(
      new Set([
        "seoKeywords",
        "coreKeyword",
        "topicKeyword",
        "writingRequirement",
        "dateAwareInstruction",
        "writingStyle",
        "introAndOutroInstruction",
        "instructionForReference",
      ]),
    )
  })
})

describe("renderArticleUserPrompt", () => {
  it("fills the sample article JSON into a user prompt with no placeholders", () => {
    const raw = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/samples/article-writer/article-input.json"), "utf8"),
    ) as unknown
    const parsed = articleInputSchema.safeParse(raw)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const userPrompt = renderArticleUserPrompt(toArticleInput(parsed.data))
    expect(userPrompt.startsWith("## 入力文:")).toBe(true)
    expect(userPrompt).toContain("AI評価はなぜ難しい？")
    expect(userPrompt).not.toMatch(/\{\{/)
    expect(userPrompt).not.toContain("## 役割")
  })
})

describe("articleUserPromptFromTask", () => {
  it("keeps an already filled user prompt and splits a combined template", () => {
    const filled = "## 入力文:\nタイトル本文"
    expect(articleUserPromptFromTask(filled)).toBe(filled)
    expect(articleUserPromptFromTask(`## 役割\n\n${filled}`)).toBe(filled)
  })
})
