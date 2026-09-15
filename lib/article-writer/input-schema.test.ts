import { describe, expect, it } from "vitest"
import { articleInputSchema, toArticleInput } from "./input-schema"

describe("articleInputSchema with the production outline shape", () => {
  const production = {
    title: "T",
    seoKeywords: "AI」「評価」「倫理」「構成",
    outline: {
      direction: "方向性",
      chapters: [
        { id: 1, heading: "この記事のまとめ", cautions: [], overview: "", sections: [], targetCharCount: 275 },
        {
          id: 2,
          heading: "AI評価が難しい理由",
          cautions: [],
          overview: "",
          sections: [
            { id: 1, heading: "抽象的な倫理原則と測定のずれ", cautions: [], overview: "", targetCharCount: 550 },
            { id: 2, heading: "指標の分断と変化する評価対象", cautions: [], overview: "", targetCharCount: 550 },
          ],
          targetCharCount: 1100,
        },
      ],
      references: [
        { url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12722731/", excerpt: "抜粋。", chapterId: 2, sectionId: 1, intendedUse: "用途" },
        { url: "https://news.mit.edu/2026/x", excerpt: "抜粋2。", chapterId: 2, sectionId: null, intendedUse: "用途2" },
      ],
    },
  }

  it("accepts heading/numeric ids and references without id or title", () => {
    const parsed = articleInputSchema.safeParse(production)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    const input = toArticleInput(parsed.data)
    expect(input.chapters).toContain("H2 [2] AI評価が難しい理由 (targetCharCount: 0)")
    expect(input.chapters).toContain("  H3 [1] 抽象的な倫理原則と測定のずれ (targetCharCount: 550)")
    expect(input.references).toContain("[1] pmc.ncbi.nlm.nih.gov")
    expect(input.references).toContain("chapterId: 2, sectionId: 1")
    expect(input.references).toContain("[2] news.mit.edu")
    expect(input.references).toContain("chapterId: 2, sectionId: -")
    expect(input.direction).toBe("方向性")
  })

  it("still accepts the title/string-id shape", () => {
    const parsed = articleInputSchema.safeParse({
      title: "T",
      seoKeywords: "a",
      outline: {
        direction: "",
        chapters: [{ id: "c1", title: "この記事のまとめ", targetCharCount: 280, sections: [] }],
        references: [{ id: "r1", chapterId: "c1", sectionId: null, title: "資料", url: "https://x", excerpt: "e" }],
      },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(toArticleInput(parsed.data).references).toContain("[1] 資料")
  })
})
