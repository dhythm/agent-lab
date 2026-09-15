import { describe, expect, it } from "vitest"
import { buildUserMessage, formatChapters, formatReferences, articleInputFromOutline } from "./input"

const outline = {
  direction: "中学生向けに平易に",
  chapters: [
    { id: "c1", title: "この記事のまとめ", evidence_type: "generic_only_ok", targetCharCount: 280, overview: "", cautions: [], sections: [] },
    {
      id: "c2",
      title: "AI評価が難しい理由",
      evidence_type: "crawl_required",
      targetCharCount: 1700,
      overview: "",
      cautions: [],
      sections: [
        { id: "s1", title: "指標の分散", targetCharCount: 850, overview: "", cautions: [] },
        { id: "s2", title: "データの不足", targetCharCount: 850, overview: "", cautions: [] },
      ],
    },
  ],
  references: [
    { id: "r1", chapterId: "c2", sectionId: "s1", title: "資料A", url: "https://a.example", excerpt: "抜粋A。", intendedUse: "分散の根拠" },
    { id: "r2", chapterId: "c2", sectionId: null, title: "資料B", url: "https://b.example", excerpt: "抜粋B。", intendedUse: "章全体" },
  ],
  coverage_check: { adoptedSlots: [], missingSlots: [], crawlRequiredRatio: 0.5 },
}

describe("formatChapters", () => {
  it("lists H2/H3 with target char counts and chapter ids", () => {
    const text = formatChapters(outline.chapters)
    expect(text).toContain("H2 [c2] AI評価が難しい理由 (targetCharCount: 0)")
    expect(text).toContain("H3 [s1] 指標の分散 (targetCharCount: 850)")
    expect(text).toContain("H2 [c1] この記事のまとめ (targetCharCount: 280)")
  })
})

describe("formatReferences", () => {
  it("numbers references and shows their target chapter/section, url and excerpt", () => {
    const text = formatReferences(outline.references)
    expect(text).toContain("[1] 資料A")
    expect(text).toContain("chapterId: c2, sectionId: s1")
    expect(text).toContain("url: https://a.example")
    expect(text).toContain("抜粋A。")
    expect(text).toContain("[2] 資料B")
    expect(text).toContain("sectionId: -")
  })
})

describe("buildUserMessage", () => {
  it("wraps each input in the XML tags the template expects", () => {
    const message = buildUserMessage({
      direction: "方向性",
      seoKeywords: "AI,評価",
      title: "タイトル",
      chapters: "章立て",
      references: "参照",
    })
    expect(message).toContain("<direction>\n方向性\n</direction>")
    expect(message).toContain("<title>\nタイトル\n</title>")
    expect(message).toContain("<chapters>\n章立て\n</chapters>")
    expect(message).toContain("<references>\n参照\n</references>")
    expect(message).toContain("### SEOキーワード:\nAI,評価")
  })
})

describe("articleInputFromOutline", () => {
  it("bridges a validated outline into the writer input", () => {
    const input = articleInputFromOutline({ title: "タイトル", seoKeywords: "AI,評価", outline })
    expect(input.direction).toBe("中学生向けに平易に")
    expect(input.chapters).toContain("H3 [s2] データの不足")
    expect(input.references).toContain("[2] 資料B")
  })
})
