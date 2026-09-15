import { z } from "zod"

export const ARTICLE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "記事のタイトル" },
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
            required: ["paragraphs"],
            additionalProperties: false,
            properties: {
              paragraphs: { type: "array", items: { type: "string", description: "本文の段落" } },
            },
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "heading", "content"],
              additionalProperties: false,
              properties: {
                id: { type: "integer", description: "節番号" },
                heading: { type: "string", description: "節見出し" },
                content: {
                  type: "object",
                  required: ["paragraphs"],
                  additionalProperties: false,
                  properties: {
                    paragraphs: { type: "array", items: { type: "string", description: "節の段落" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  required: ["title", "contents"],
  additionalProperties: false,
} as const satisfies { type: "object" } & Record<string, unknown>

const contentSchema = z.strictObject({ paragraphs: z.array(z.string()) })

export const articleSchema = z.strictObject({
  title: z.string(),
  contents: z.array(
    z.strictObject({
      id: z.int(),
      heading: z.string(),
      content: contentSchema,
      sections: z.array(z.strictObject({ id: z.int(), heading: z.string(), content: contentSchema })),
    }),
  ),
})

export type Article = z.infer<typeof articleSchema>

export type ParseArticleResult = { ok: true; article: Article } | { ok: false; errors: string[] }

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const match = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n```$/.exec(trimmed)
  return match ? match[1] : trimmed
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, key) => (typeof key === "number" ? `${acc}[${key}]` : acc ? `${acc}.${String(key)}` : String(key)), "")
}

export function parseArticle(text: string): ParseArticleResult {
  let data: unknown
  try {
    data = JSON.parse(stripCodeFence(text))
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const result = articleSchema.safeParse(data)
  if (result.success) return { ok: true, article: result.data }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = formatPath(issue.path) || "(root)"
      const keys = "keys" in issue && Array.isArray(issue.keys) ? ` (${issue.keys.join(", ")})` : ""
      return `${path}: ${issue.message}${keys}`
    }),
  }
}
