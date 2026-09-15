import { NextResponse } from "next/server"
import { z } from "zod"
import { loadConfig } from "@/lib/agent-lab/config"
import { createAnthropicCompleter, createOpenAICompleter } from "@/lib/article-writer/completers"
import { articleInputSchema, toArticleInput } from "@/lib/article-writer/input-schema"
import { writeArticle } from "@/lib/article-writer/write-article"

export const runtime = "nodejs"
export const maxDuration = 600

const bodySchema = z.object({
  provider: z.enum(["anthropic", "openai"]).default("anthropic"),
  model: z.string().trim().min(1).optional(),
  input: articleInputSchema,
})

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 })
  }
  const { provider, model, input: raw } = parsed.data
  const input = toArticleInput(raw)

  const config = loadConfig()
  const completer =
    provider === "anthropic"
      ? config.anthropic.enabled
        ? createAnthropicCompleter(model ?? config.anthropic.model)
        : undefined
      : config.openai.enabled
        ? createOpenAICompleter(model ?? config.openai.model)
        : undefined
  if (!completer) {
    return NextResponse.json({ error: `${provider} is not configured (set the API key in .env.local)` }, { status: 503 })
  }

  try {
    const result = await writeArticle(input, completer, { signal: request.signal })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[article] generation failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
