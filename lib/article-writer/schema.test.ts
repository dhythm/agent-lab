import { describe, expect, it } from "vitest"
import { parseArticle, ARTICLE_RESPONSE_JSON_SCHEMA } from "./schema"

const valid = {
  title: "T",
  contents: [
    { id: 1, heading: "この記事のまとめ", content: { paragraphs: ["要約。"] }, sections: [] },
    {
      id: 2,
      heading: "章",
      content: { paragraphs: [] },
      sections: [{ id: 1, heading: "節", content: { paragraphs: ["導入。", "本文。"] } }],
    },
  ],
}

describe("parseArticle", () => {
  it("accepts a valid article", () => {
    const result = parseArticle(JSON.stringify(valid))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.article.contents[1].sections[0].heading).toBe("節")
  })

  it("strips markdown code fences before parsing", () => {
    const result = parseArticle("```json\n" + JSON.stringify(valid) + "\n```")
    expect(result.ok).toBe(true)
  })

  it("reports invalid JSON", () => {
    const result = parseArticle("{not json")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/JSON/)
  })

  it("reports schema violations with paths", () => {
    const broken = { ...valid, contents: [{ ...valid.contents[0], id: "1", extra: true }] }
    const result = parseArticle(JSON.stringify(broken))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("contents[0].id"))).toBe(true)
      expect(result.errors.some((e) => e.includes("extra"))).toBe(true)
    }
  })

  it("exposes the JSON schema with strict object settings", () => {
    expect(ARTICLE_RESPONSE_JSON_SCHEMA.additionalProperties).toBe(false)
    expect(ARTICLE_RESPONSE_JSON_SCHEMA.required).toEqual(["title", "contents"])
  })
})
