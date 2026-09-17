import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA,
  validateSeoOutput,
} from "./seo-output"

const submitted = [
  {
    id: 1,
    heading: "概要",
    content: { paragraphs: ["元の本文です。"] },
    sections: [],
  },
  {
    id: 2,
    heading: "詳細",
    content: { paragraphs: [] },
    sections: [
      {
        id: 1,
        heading: "引用",
        content: { paragraphs: ["4文あります。2文目です。3文目です。4文目です。"] },
      },
    ],
  },
]

const userPrompt = `## 入力文:
### 提出されたSEO記事:
#### タイトル:
変更禁止タイトル

#### 内容:
${JSON.stringify(submitted)}

### クローリング記事（タイトル、内容、リンク）:
[]`

function output(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    contents: submitted,
    title: "変更禁止タイトル",
    ...overrides,
  })
}

describe("validateSeoOutput", () => {
  it("exports the strict ai_review output contract", () => {
    expect(AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA).toMatchObject({
      name: "ai_review_output",
      strict: true,
      schema: {
        type: "object",
        required: ["contents", "title"],
        additionalProperties: false,
      },
    })
  })

  it("validates the built-in full-size SEO example", () => {
    const samples = path.join(process.cwd(), "public", "samples")
    const prompt = readFileSync(path.join(samples, "seo-proofread-user.txt"), "utf8")
    const expected = readFileSync(path.join(samples, "seo-proofread-expected.json"), "utf8")

    expect(validateSeoOutput(prompt, expected)).toMatchObject({ ok: true })
  })

  it("accepts valid JSON and returns canonical JSON", () => {
    const result = validateSeoOutput(userPrompt, output())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(JSON.parse(result.output)).toEqual(JSON.parse(output()))
      expect(result.output).not.toContain("\n")
    }
  })

  it("rejects markdown code fences and malformed JSON", () => {
    expect(validateSeoOutput(userPrompt, `\`\`\`json\n${output()}\n\`\`\``)).toMatchObject({
      ok: false,
    })
    expect(validateSeoOutput(userPrompt, "{")).toMatchObject({ ok: false })
  })

  it("rejects title and heading changes", () => {
    expect(validateSeoOutput(userPrompt, output({ title: "別タイトル" }))).toMatchObject({
      ok: false,
    })

    const changed = structuredClone(submitted)
    changed[1].sections[0].heading = "別見出し"
    expect(validateSeoOutput(userPrompt, output({ contents: changed }))).toMatchObject({
      ok: false,
    })
  })

  it("allows paragraph splitting but rejects more than four lists", () => {
    const split = structuredClone(submitted)
    split[0].content.paragraphs = ["前半。", "後半。"]
    expect(validateSeoOutput(userPrompt, output({ contents: split }))).toMatchObject({ ok: true })

    split[0].content.paragraphs = Array.from(
      { length: 5 },
      (_, index) => `要点${index + 1}です。<ul><li>項目</li></ul>`,
    )
    const result = validateSeoOutput(userPrompt, output({ contents: split }))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toMatch(/4/)
  })
})
