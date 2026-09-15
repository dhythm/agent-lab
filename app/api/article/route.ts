import { NextResponse } from "next/server"
import { z } from "zod"
import { loadConfig } from "@/lib/agent-lab/config"
import { createAnthropicCompleter, createOpenAICompleter } from "@/lib/article-writer/completers"
import { articleInputFromOutline, type ArticleInput } from "@/lib/article-writer/input"
import { writeArticle } from "@/lib/article-writer/write-article"

export const runtime = "nodejs"
export const maxDuration = 600

const templateFields = {
  seoKeywords: z.string().trim().min(1),
  coreKeyword: z.string().trim().min(1).optional(),
  topicKeyword: z.string().trim().min(1).optional(),
  writingStyle: z.string().optional(),
  writingRequirement: z.string().optional(),
  dateAwareInstruction: z.string().optional(),
  introAndOutroInstruction: z.string().optional(),
  instructionForReference: z.string().optional(),
}

const textInputSchema = z.object({
  ...templateFields,
  title: z.string().trim().min(1),
  direction: z.string().default(""),
  chapters: z.string().min(1),
  references: z.string().min(1),
})

const outlineSchema = z.object({
  direction: z.string().default(""),
  chapters: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      targetCharCount: z.number(),
      sections: z.array(z.object({ id: z.string(), title: z.string(), targetCharCount: z.number() })).default([]),
    }),
  ),
  references: z.array(
    z.object({
      id: z.string(),
      chapterId: z.string(),
      sectionId: z.string().nullable().default(null),
      title: z.string(),
      url: z.string(),
      excerpt: z.string(),
      intendedUse: z.string().optional(),
    }),
  ),
})

const outlineInputSchema = z.object({ ...templateFields, title: z.string().trim().min(1), outline: outlineSchema })

const bodySchema = z.object({
  provider: z.enum(["anthropic", "openai"]).default("anthropic"),
  model: z.string().trim().min(1).optional(),
  input: z.union([textInputSchema, outlineInputSchema]),
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
  const input: ArticleInput = "outline" in raw ? articleInputFromOutline(raw) : raw

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
    const result = await writeArticle(input, completer)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[article] generation failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
