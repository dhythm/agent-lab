import { parseTargets } from "@/lib/article-writer/write-article"

interface MockSection { id: number; heading: string; content: { paragraphs: string[] } }
interface MockChapter extends MockSection { sections: MockSection[] }

/** Builds a schema-valid article from a rendered task prompt (title + chapters block), for mock runs. */
export function mockArticleFromPrompt(rawPrompt: string): { title: string; contents: MockChapter[] } {
  const prompt = rawPrompt.replace(/\r\n/g, "\n")
  const title = /### タイトル:\n([^\n]*)/.exec(prompt)?.[1]?.trim() || "Mock article"
  const chaptersBlock = /### 章立てと目安となる文字数:\n([\s\S]*?)\n\n###/.exec(prompt)?.[1] ?? ""
  const targets = parseTargets(chaptersBlock)
  const contents: MockChapter[] = []
  let current: MockChapter | undefined
  for (const line of chaptersBlock.split("\n")) {
    const match = /^\s*(H[23])\s+(?:\[[^\]]*\]\s+)?(.+?)\s+\(targetCharCount/.exec(line)
    if (!match) continue
    const heading = match[2]
    const target = targets.get(heading) ?? 0
    const body = `${heading}についての本文です。`.repeat(Math.max(1, Math.ceil(target / 14)))
    if (match[1] === "H2") {
      current = { id: contents.length + 1, heading, content: { paragraphs: target > 0 ? [`${heading}の導入文です。`, body] : [] }, sections: [] }
      contents.push(current)
    } else if (current) {
      current.sections.push({ id: current.sections.length + 1, heading, content: { paragraphs: [`${heading}の導入文です。`, body] } })
    }
  }
  return { title, contents }
}
