import { describe, expect, it } from "vitest"
import { renderTemplate, renderSystemPrompt, ARTICLE_SYSTEM_TEMPLATE } from "./template"

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
