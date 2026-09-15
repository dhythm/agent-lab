import { z } from "zod"
import { articleInputFromOutline, type ArticleInput } from "./input"

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

export const outlineSchema = z.object({
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

export const outlineArticleInputSchema = z.object({ ...templateFields, title: z.string().trim().min(1), outline: outlineSchema })

/** Either form the writer accepts: pre-formatted text, or the outline produced by step 1. */
export const articleInputSchema = z.union([textArticleInputSchema, outlineArticleInputSchema])

export function toArticleInput(value: z.infer<typeof articleInputSchema>): ArticleInput {
  return "outline" in value ? articleInputFromOutline(value) : value
}

function flatten(issues: z.core.$ZodIssue[]): z.core.$ZodIssue[] {
  return issues.flatMap((issue) => (issue.code === "invalid_union" ? issue.errors.flatMap(flatten) : [issue]))
}

/** Union branches are expanded so the message names the concrete missing fields. */
export function describeIssues(error: z.ZodError): string {
  const lines = flatten(error.issues).map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
  return [...new Set(lines)].join("; ")
}
