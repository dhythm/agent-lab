import { z } from "zod"

export const AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA = {
  name: "ai_review_output",
  strict: true,
  description: "AIレビュー後の記事",
  schema: {
    type: "object",
    properties: {
      contents: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "heading", "content", "sections"],
          additionalProperties: false,
          properties: {
            id: { type: "integer", description: "章番号" },
            heading: { type: "string", description: "章見出し" },
            content: {
              type: "object",
              description: "",
              required: ["paragraphs"],
              additionalProperties: false,
              properties: {
                paragraphs: {
                  type: "array",
                  description: "",
                  items: { type: "string", description: "段落" },
                },
              },
            },
            sections: {
              type: "array",
              description: "",
              items: {
                type: "object",
                required: ["id", "heading", "content"],
                additionalProperties: false,
                properties: {
                  id: { type: "integer", description: "節番号" },
                  heading: { type: "string", description: "節見出し" },
                  content: {
                    type: "object",
                    description: "",
                    required: ["paragraphs"],
                    additionalProperties: false,
                    properties: {
                      paragraphs: {
                        type: "array",
                        description: "",
                        items: { type: "string", description: "段落" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      title: {
        type: "string",
        description: "記事のタイトル",
      },
    },
    required: ["contents", "title"],
    additionalProperties: false,
  },
} as const

const contentSchema = z.object({ paragraphs: z.array(z.string()) }).strict()
const sectionSchema = z
  .object({
    id: z.number(),
    heading: z.string(),
    content: contentSchema,
  })
  .strict()
const articleSchema = z
  .object({
    id: z.number(),
    heading: z.string(),
    content: contentSchema,
    sections: z.array(sectionSchema),
  })
  .strict()
const outputSchema = z
  .object({
    contents: z.array(articleSchema),
    title: z.string(),
  })
  .strict()

export type SeoOutputValidation =
  | { ok: true; output: string }
  | { ok: false; error: string }

interface SubmittedArticle {
  title: string
  contents: z.infer<typeof articleSchema>[]
}

function jsonArrayAt(text: string, start: number): string | undefined {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === "[") depth += 1
    else if (char === "]") {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return undefined
}

function submittedArticle(userPrompt: string): SubmittedArticle {
  const titleMatch = userPrompt.match(
    /### 提出されたSEO記事:[\s\S]*?#### タイトル:\s*\n([^\n]+)[\s\S]*?#### 内容:/,
  )
  if (!titleMatch) throw new Error("提出されたSEO記事のタイトルを入力から取得できません")

  const contentMarker = userPrompt.indexOf("#### 内容:", titleMatch.index)
  const arrayStart = userPrompt.indexOf("[", contentMarker)
  const source = arrayStart >= 0 ? jsonArrayAt(userPrompt, arrayStart) : undefined
  if (!source) throw new Error("提出されたSEO記事の内容を入力から取得できません")

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error("提出されたSEO記事の内容が妥当なJSONではありません")
  }
  const contents = z.array(articleSchema).safeParse(parsed)
  if (!contents.success) throw new Error("提出されたSEO記事の構造を認識できません")
  return { title: titleMatch[1].trim(), contents: contents.data }
}

function compareStructure(
  expected: SubmittedArticle,
  actual: z.infer<typeof outputSchema>,
): string | undefined {
  if (actual.title !== expected.title) return "タイトルが変更されています"
  if (actual.contents.length !== expected.contents.length) return "章の数が変更されています"

  for (let index = 0; index < expected.contents.length; index += 1) {
    const source = expected.contents[index]
    const output = actual.contents[index]
    if (output.id !== source.id || output.heading !== source.heading) {
      return `章${index + 1}のIDまたは見出しが変更されています`
    }
    if (output.sections.length !== source.sections.length) {
      return `「${source.heading}」の節の数が変更されています`
    }
    for (let sectionIndex = 0; sectionIndex < source.sections.length; sectionIndex += 1) {
      const sourceSection = source.sections[sectionIndex]
      const outputSection = output.sections[sectionIndex]
      if (
        outputSection.id !== sourceSection.id ||
        outputSection.heading !== sourceSection.heading
      ) {
        return `「${source.heading}」の節${sectionIndex + 1}のIDまたは見出しが変更されています`
      }
    }
  }
  return undefined
}

function listError(output: z.infer<typeof outputSchema>): string | undefined {
  const paragraphs = output.contents.flatMap((article) => [
    ...article.content.paragraphs,
    ...article.sections.flatMap((section) => section.content.paragraphs),
  ])
  const listCount = paragraphs.reduce(
    (count, paragraph) => count + (paragraph.match(/<(?:ul|ol)>/g)?.length ?? 0),
    0,
  )
  if (listCount > 4) return `箇条書きは記事全体で最大4回です（検出: ${listCount}回）`

  for (const paragraph of paragraphs) {
    const opens = paragraph.match(/<(ul|ol)>/g)?.length ?? 0
    const closes = paragraph.match(/<\/(ul|ol)>/g)?.length ?? 0
    if (opens !== closes) return "箇条書きのHTMLタグが閉じていません"
  }
  return undefined
}

export function validateSeoOutput(userPrompt: string, rawOutput: string): SeoOutputValidation {
  if (/^\s*```/.test(rawOutput)) {
    return { ok: false, error: "Markdownのコードフェンスは出力できません" }
  }

  let parsedOutput: unknown
  try {
    parsedOutput = JSON.parse(rawOutput)
  } catch {
    return { ok: false, error: "出力が妥当なJSONではありません" }
  }
  const parsed = outputSchema.safeParse(parsedOutput)
  if (!parsed.success) {
    return { ok: false, error: `出力JSONの構造が不正です: ${z.prettifyError(parsed.error)}` }
  }

  let expected: SubmittedArticle
  try {
    expected = submittedArticle(userPrompt)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  const structureError = compareStructure(expected, parsed.data)
  if (structureError) return { ok: false, error: structureError }
  const invalidList = listError(parsed.data)
  if (invalidList) return { ok: false, error: invalidList }

  return { ok: true, output: JSON.stringify(parsed.data) }
}
