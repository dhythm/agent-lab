import { readFile } from "node:fs/promises"
import path from "node:path"

let cachedSystemPrompt: string | undefined

export async function getSeoProofreadSystemPrompt(): Promise<string> {
  cachedSystemPrompt ??= await readFile(
    path.join(process.cwd(), "public", "samples", "seo-proofread-system.txt"),
    "utf8",
  )
  return cachedSystemPrompt
}
