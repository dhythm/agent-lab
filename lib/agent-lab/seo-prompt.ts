import { readFile } from "node:fs/promises"
import path from "node:path"
import { AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA } from "./seo-output"

let cachedSystemPrompt: string | undefined

export async function getSeoProofreadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt
  const instructions = await readFile(
    path.join(process.cwd(), "public", "samples", "seo-proofread-system.txt"),
    "utf8",
  )
  cachedSystemPrompt = [
    instructions.trimEnd(),
    "",
    "## 出力形式",
    "- 次のJSON Schemaに厳密に従い、JSON本文のみを出力する。",
    "- 評価、講評、前置き、Markdownのコードフェンスは出力しない。",
    JSON.stringify(AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA.schema),
  ].join("\n")
  return cachedSystemPrompt
}
