import type { ArticleTemplateVariables } from "./template"

/** Chapter/section shape produced by the outline step (public/samples/seo-outline/outline.schema.json). */
export interface OutlineSection {
  id: string
  title: string
  targetCharCount: number
}

export interface OutlineChapter {
  id: string
  title: string
  targetCharCount: number
  sections: OutlineSection[]
}

export interface OutlineReference {
  id: string
  chapterId: string
  sectionId: string | null
  title: string
  url: string
  excerpt: string
  intendedUse?: string
}

export interface Outline {
  direction: string
  chapters: OutlineChapter[]
  references: OutlineReference[]
}

/** Everything the writer needs for one article. Text fields are passed through verbatim. */
export interface ArticleInput extends Omit<ArticleTemplateVariables, "coreKeyword" | "topicKeyword"> {
  direction: string
  seoKeywords: string
  /** Defaults to seoKeywords when omitted. */
  coreKeyword?: string
  /** Defaults to the last comma-separated keyword when omitted. */
  topicKeyword?: string
  title: string
  chapters: string
  references: string
}

/**
 * A chapter that has sections holds no body of its own, so its own target is 0;
 * the sections carry the counts. Matches the template's "no double counting" rule.
 */
export function formatChapters(chapters: OutlineChapter[]): string {
  const lines: string[] = []
  for (const chapter of chapters) {
    const own = chapter.sections.length > 0 ? 0 : chapter.targetCharCount
    lines.push(`H2 [${chapter.id}] ${chapter.title} (targetCharCount: ${own})`)
    for (const section of chapter.sections) {
      lines.push(`  H3 [${section.id}] ${section.title} (targetCharCount: ${section.targetCharCount})`)
    }
  }
  return lines.join("\n")
}

export function formatReferences(references: OutlineReference[]): string {
  return references
    .map((ref, index) => {
      const header = `[${index + 1}] ${ref.title}`
      const target = `chapterId: ${ref.chapterId}, sectionId: ${ref.sectionId ?? "-"}`
      const use = ref.intendedUse ? `intendedUse: ${ref.intendedUse}\n` : ""
      return `${header}\n${target}\nurl: ${ref.url}\n${use}excerpt:\n${ref.excerpt}`
    })
    .join("\n\n")
}

export function buildUserMessage(input: Pick<ArticleInput, "direction" | "seoKeywords" | "title" | "chapters" | "references">): string {
  return [
    "## 入力文:",
    "### 記事の方向性",
    `<direction>\n${input.direction.trim() || "なし"}\n</direction>`,
    "",
    "### SEOキーワード:",
    input.seoKeywords,
    "",
    "### タイトル:",
    `<title>\n${input.title}\n</title>`,
    "",
    "### 章立てと目安となる文字数:",
    `<chapters>\n${input.chapters}\n</chapters>`,
    "",
    "### 選択されたクローリング記事（タイトル、内容、リンク）:",
    `<references>\n${input.references}\n</references>`,
  ].join("\n")
}

export interface OutlineBridgeInput extends Omit<ArticleInput, "direction" | "chapters" | "references"> {
  outline: Outline
}

/** Bridge from the validated outline (step 1) to the writer input (step 2). Every template variable passes through. */
export function articleInputFromOutline(input: OutlineBridgeInput): ArticleInput {
  const { outline, ...variables } = input
  return {
    ...variables,
    direction: outline.direction,
    chapters: formatChapters(outline.chapters),
    references: formatReferences(outline.references),
  }
}
