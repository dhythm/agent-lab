import { z } from "zod"
import { articleInputFromOutline, type ArticleInput } from "./input"
import { renderArticleUserPrompt } from "./template"

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

export const textArticleInputSchema = z.object({
  ...templateFields,
  title: z.string().trim().min(1),
  direction: z.string().default(""),
  chapters: z.string().min(1),
  references: z.string().min(1),
})

// The outline step emits numeric ids and `heading`; the hand-written sample uses string ids and
// `title`. Both are normalised to { id: string, title: string } here.
const idSchema = z.union([z.string(), z.number()]).transform(String)

const sectionSchema = z
  .object({ id: idSchema, title: z.string().optional(), heading: z.string().optional(), targetCharCount: z.number() })
  .transform((s, ctx) => ({ id: s.id, title: s.title ?? s.heading ?? fail(ctx, "section"), targetCharCount: s.targetCharCount }))

const chapterSchema = z
  .object({
    id: idSchema,
    title: z.string().optional(),
    heading: z.string().optional(),
    targetCharCount: z.number(),
    sections: z.array(sectionSchema).default([]),
  })
  .transform((c, ctx) => ({ id: c.id, title: c.title ?? c.heading ?? fail(ctx, "chapter"), targetCharCount: c.targetCharCount, sections: c.sections }))

function fail(ctx: z.RefinementCtx, kind: string): string {
  ctx.addIssue({ code: "custom", message: `${kind} needs a title (or heading)` })
  return ""
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const referenceSchema = z
  .object({
    id: idSchema.optional(),
    chapterId: idSchema,
    sectionId: z.union([z.string(), z.number()]).nullable().optional().transform((v) => (v == null ? null : String(v))),
    title: z.string().optional(),
    url: z.string(),
    excerpt: z.string(),
    intendedUse: z.string().optional(),
  })
  .transform((r) => ({
    id: r.id,
    chapterId: r.chapterId,
    sectionId: r.sectionId,
    title: r.title ?? hostOf(r.url),
    url: r.url,
    excerpt: r.excerpt,
    intendedUse: r.intendedUse,
  }))

export const outlineSchema = z.object({
  direction: z.string().default(""),
  chapters: z.array(chapterSchema),
  references: z.array(referenceSchema).transform((refs) => refs.map((r, i) => ({ ...r, id: r.id ?? `r${i + 1}` }))),
})

export const outlineArticleInputSchema = z.object({ ...templateFields, title: z.string().trim().min(1), outline: outlineSchema })

/** Either form the writer accepts: pre-formatted text, or the outline produced by step 1. */
export const articleInputSchema = z.union([textArticleInputSchema, outlineArticleInputSchema])

export function toArticleInput(value: z.infer<typeof articleInputSchema>): ArticleInput {
  return "outline" in value ? articleInputFromOutline(value) : value
}

/** Fills the writer user-input template from a JSON attachment (or /api/article request body). */
export function userPromptFromArticleJson(raw: unknown): string {
  const body = typeof raw === "object" && raw !== null && "input" in raw ? (raw as { input: unknown }).input : raw
  const parsed = articleInputSchema.safeParse(body)
  if (!parsed.success) throw new Error(describeIssues(parsed.error))
  return renderArticleUserPrompt(toArticleInput(parsed.data))
}

function flatten(issues: z.core.$ZodIssue[]): z.core.$ZodIssue[] {
  return issues.flatMap((issue) => (issue.code === "invalid_union" ? issue.errors.flatMap(flatten) : [issue]))
}

/** Union branches are expanded so the message names the concrete missing fields. */
export function describeIssues(error: z.ZodError): string {
  const lines = flatten(error.issues).map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
  return [...new Set(lines)].join("; ")
}
