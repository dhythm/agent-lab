import { describe, expect, it } from "vitest"
import { validateOutline } from "../../public/samples/seo-outline/validate-outline.mjs"

const resourceContent =
  "評価は出力の品質を測定するのに役立ちます。ルーブリックは基準の集合です。基準はルーブリック内の質問または記述です。キャリブレーションは一貫性を高めます。"

const input = {
  title: "AI評価はなぜ難しい？倫理を測る基準と体制の構成を解く",
  reportResources: [
    { title: "AI評価の記事", url: "https://example.com/eval", content: resourceContent },
  ],
}

function section(id: string, title: string, targetCharCount: number) {
  return { id, title, targetCharCount, overview: "", cautions: [] }
}

function chapter(
  id: string,
  title: string,
  evidence_type: string,
  targetCharCount: number,
  sections: ReturnType<typeof section>[] = [],
) {
  return { id, title, evidence_type, targetCharCount, overview: "", cautions: [], sections }
}

function validOutline() {
  return {
    direction: "AI評価の難しさを中学生にも分かるように説明する",
    chapters: [
      chapter("c1", "この記事のまとめ", "generic_only_ok", 280),
      chapter("c2", "AI評価が難しい理由", "crawl_required", 1800, [
        section("s1", "評価と倫理原則の関係", 900),
        section("s2", "指標の偏りと分散", 900),
      ]),
      chapter("c3", "倫理を測る基準の作り方", "crawl_optional", 1500),
      chapter("c4", "評価体制の構成", "crawl_required", 1500),
    ],
    references: [
      {
        id: "r1",
        chapterId: "c2",
        sectionId: "s1",
        title: "AI評価の記事",
        url: "https://example.com/eval",
        excerpt: "評価は出力の品質を測定するのに役立ちます。ルーブリックは基準の集合です。基準はルーブリック内の質問または記述です。",
        intendedUse: "評価とルーブリックの定義",
      },
      {
        id: "r2",
        chapterId: "c4",
        sectionId: null,
        title: "AI評価の記事",
        url: "https://example.com/eval",
        excerpt: "キャリブレーションは一貫性を高めます。",
        intendedUse: "評価者の認識合わせ",
      },
    ],
    coverage_check: {
      adoptedSlots: ["定義・前提", "背景・課題", "手順・進め方"],
      missingSlots: [],
      crawlRequiredRatio: 0.5,
    },
  }
}

describe("validateOutline", () => {
  it("passes a well-formed outline and returns a stable validationId", () => {
    const report = validateOutline(validOutline(), input)
    expect(report.status).toBe("pass")
    expect(report.violations).toEqual([])
    expect(report.validationId).toMatch(/^[0-9a-f]{16}$/)
    expect(validateOutline(validOutline(), input).validationId).toBe(report.validationId)
  })

  it("fails when the excerpt is not a verbatim passage of the referenced resource", () => {
    const outline = validOutline()
    outline.references[0].excerpt = "評価は品質を測るのに役立つ（要約）。"
    const report = validateOutline(outline, input)
    expect(report.status).toBe("fail")
    expect(report.violations.some((v) => v.code === "excerpt_not_found" && v.referenceId === "r1")).toBe(true)
  })

  it("fails when the reference URL is not in reportResources", () => {
    const outline = validOutline()
    outline.references[0].url = "https://example.com/unknown"
    const report = validateOutline(outline, input)
    expect(report.violations.map((v) => v.code)).toContain("unknown_resource")
  })

  it("fails when a reference points at a chapter or section that does not exist", () => {
    const outline = validOutline()
    outline.references[1].chapterId = "c9"
    outline.references[0].sectionId = "s9"
    const codes = validateOutline(outline, input).violations.map((v) => v.code)
    expect(codes).toContain("unknown_chapter")
    expect(codes).toContain("unknown_section")
  })

  it("fails when a crawl_required chapter has no reference", () => {
    const outline = validOutline()
    outline.references = outline.references.filter((r) => r.chapterId !== "c4")
    const report = validateOutline(outline, input)
    expect(report.violations.some((v) => v.code === "crawl_required_without_reference" && v.chapterId === "c4")).toBe(
      true,
    )
  })

  it("fails on fixed-structure violations", () => {
    const outline = validOutline()
    outline.chapters[0].title = "はじめに"
    outline.chapters.push(chapter("c5", "おわりに", "generic_only_ok", 300))
    outline.chapters[0].sections = [section("s0", "節", 400)]
    const codes = validateOutline(outline, input).violations.map((v) => v.code)
    expect(codes).toContain("missing_summary_chapter")
    expect(codes).toContain("forbidden_heading")
    expect(codes).toContain("sections_in_edge_chapter")
  })

  it("fails on unknown evidence_type and extra top-level keys", () => {
    const outline = validOutline() as Record<string, unknown>
    ;(outline.chapters as { evidence_type: string }[])[1].evidence_type = "maybe"
    outline.extra = 1
    const codes = validateOutline(outline, input).violations.map((v) => v.code)
    expect(codes).toContain("invalid_evidence_type")
    expect(codes).toContain("unexpected_key")
  })

  it("warns and rescales when the total char count is outside the target range", () => {
    const outline = validOutline()
    outline.chapters[2].targetCharCount = 300
    const report = validateOutline(outline, input)
    expect(report.status).toBe("pass")
    expect(report.warnings.some((w) => w.code === "total_chars_adjusted")).toBe(true)
    type Counted = { targetCharCount: number; sections: { targetCharCount: number }[] }
    const total = (report.outline!.chapters as Counted[]).reduce(
      (sum, c) => sum + (c.sections.length ? c.sections.reduce((s, x) => s + x.targetCharCount, 0) : c.targetCharCount),
      0,
    )
    expect(total).toBeGreaterThanOrEqual(5000)
    expect(total).toBeLessThanOrEqual(6000)
    expect(report.outline!.chapters[0].targetCharCount).toBe(280)
  })

  it("corrects the crawl_required ratio and warns instead of failing", () => {
    const outline = validOutline()
    outline.coverage_check.crawlRequiredRatio = 0.9
    const report = validateOutline(outline, input)
    expect(report.status).toBe("pass")
    expect(report.outline!.coverage_check.crawlRequiredRatio).toBe(0.5)
    expect(report.warnings.some((w) => w.code === "crawl_required_ratio_adjusted")).toBe(true)
  })

  it("warns on short sections and long headings without failing", () => {
    const outline = validOutline()
    outline.chapters[1].sections[0].targetCharCount = 200
    outline.chapters[1].sections[1].targetCharCount = 1600
    outline.chapters[2].title = "とても長い見出しでありながら二十文字を超えてしまう章タイトルについて"
    const report = validateOutline(outline, input)
    expect(report.status).toBe("pass")
    const codes = report.warnings.map((w) => w.code)
    expect(codes).toContain("section_too_short")
    expect(codes).toContain("heading_too_long")
    expect(codes).toContain("heading_style")
  })

  it("reports a parse-level violation for non-object input", () => {
    const report = validateOutline("not an object", input)
    expect(report.status).toBe("fail")
    expect(report.violations[0].code).toBe("invalid_outline")
  })
})
