import { describe, expect, it } from "vitest"
import { AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA } from "./seo-output"
import { getSeoProofreadSystemPrompt } from "./seo-prompt"

describe("getSeoProofreadSystemPrompt", () => {
  it("includes the complete ai_review JSON Schema", async () => {
    const prompt = await getSeoProofreadSystemPrompt()

    expect(prompt).toContain("## 出力形式")
    expect(prompt).toContain(JSON.stringify(AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA.schema))
    expect(prompt).toContain("JSON本文のみ")
  })
})
