import type { CompletionRequest, CompletionResult, StructuredCompleter } from "@/lib/article-writer/write-article"
import { parseTargets } from "@/lib/article-writer/write-article"

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("cancelled"))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new Error("cancelled"))
    })
  })
}

/** Builds a schema-valid article from the headings in the <chapters> block, without calling any API. */
export function createMockCompleter(id: string): StructuredCompleter {
  let calls = 0
  return {
    id,
    model: "mock",
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      await sleep(1200, request.signal)
      calls += 1
      // First reply is deliberately broken so the retry path is visible in the UI.
      if (calls === 1) return { text: '{"title": "mock", "contents": [{"id": "1"}]}', usage: { inputTokens: 900, outputTokens: 20 } }
      const chaptersBlock = /<chapters>\n([\s\S]*?)\n<\/chapters>/.exec(request.messages[0].content)?.[1] ?? ""
      const title = /<title>\n([\s\S]*?)\n<\/title>/.exec(request.messages[0].content)?.[1] ?? "Mock article"
      const targets = parseTargets(chaptersBlock)
      const contents: unknown[] = []
      let current: { id: number; heading: string; content: { paragraphs: string[] }; sections: { id: number; heading: string; content: { paragraphs: string[] } }[] } | undefined
      for (const line of chaptersBlock.split("\n")) {
        const match = /^\s*(H[23])\s+(?:\[[^\]]*\]\s+)?(.+?)\s+\(targetCharCount/.exec(line)
        if (!match) continue
        const heading = match[2]
        const body = `${heading}についての本文です。`.repeat(Math.max(1, Math.ceil((targets.get(heading) ?? 0) / 14)))
        if (match[1] === "H2") {
          current = { id: contents.length + 1, heading, content: { paragraphs: [] }, sections: [] }
          contents.push(current)
          if ((targets.get(heading) ?? 0) > 0) current.content.paragraphs = [`${heading}の導入文です。`, body]
        } else if (current) {
          current.sections.push({ id: current.sections.length + 1, heading, content: { paragraphs: [`${heading}の導入文です。`, body] } })
        }
      }
      return { text: JSON.stringify({ title, contents }), usage: { inputTokens: 950, outputTokens: 1800, cachedInputTokens: 800 } }
    },
  }
}
