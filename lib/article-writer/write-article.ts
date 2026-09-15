import { renderSystemPrompt } from "./template"
import { buildUserMessage, type ArticleInput } from "./input"
import { ARTICLE_RESPONSE_JSON_SCHEMA, parseArticle, type Article } from "./schema"

export interface CompletionMessage {
  role: "user" | "assistant"
  content: string
}

export interface CompletionRequest {
  system: string
  messages: CompletionMessage[]
  /** JSON schema the reply must satisfy. Providers pass it to their structured-output option. */
  schema: Record<string, unknown>
  /** Aborting it cancels the in-flight request. */
  signal?: AbortSignal
}

export interface CompletionUsage {
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
}

export interface CompletionResult {
  text: string
  usage: CompletionUsage
}

/** One provider-specific way of turning a prompt into structured JSON text. */
export interface StructuredCompleter {
  id: string
  model: string
  complete(request: CompletionRequest): Promise<CompletionResult>
}

export interface LengthReportEntry {
  heading: string
  targetCharCount: number
  actualCharCount: number
  status: "ok" | "short" | "long"
}

export interface WriteArticleResult {
  article: Article
  attempts: number
  usage: CompletionUsage
  lengthReport: LengthReportEntry[]
  provider: { id: string; model: string }
}

export interface WriteArticleOptions {
  /** Extra attempts after the first reply fails validation. Default 1. */
  maxRetries?: number
  signal?: AbortSignal
  /** Observes each attempt; used by Agent Lab to render the timeline. */
  onAttempt?: (info: AttemptInfo) => Promise<void> | void
}

export type AttemptInfo =
  | { phase: "request"; attempt: number; request: CompletionRequest }
  | { phase: "reply"; attempt: number; text: string; usage: CompletionUsage; errors: string[] }

const TARGET_LINE = /^\s*H[23]\s+(?:\[[^\]]*\]\s+)?(.+?)\s+\(targetCharCount:\s*(\d+)\)\s*$/

/** Parse "H2 [id] heading (targetCharCount: N)" lines so the report works with any chapters text of that shape. */
export function parseTargets(chapters: string): Map<string, number> {
  const targets = new Map<string, number>()
  for (const line of chapters.split("\n")) {
    const match = TARGET_LINE.exec(line)
    if (match) targets.set(match[1], Number(match[2]))
  }
  return targets
}

function charCount(paragraphs: string[]): number {
  return paragraphs.reduce((sum, p) => sum + Array.from(p.replace(/https?:\/\/\S+/g, "")).length, 0)
}

function status(target: number, actual: number): LengthReportEntry["status"] {
  if (target > 0 && actual < target) return "short"
  if (target > 0 && actual > target * 1.5) return "long"
  return "ok"
}

export function buildLengthReport(article: Article, chapters: string): LengthReportEntry[] {
  const targets = parseTargets(chapters)
  const entries: LengthReportEntry[] = []
  for (const chapter of article.contents) {
    const target = targets.get(chapter.heading) ?? 0
    const actual = charCount(chapter.content.paragraphs)
    entries.push({ heading: chapter.heading, targetCharCount: target, actualCharCount: actual, status: status(target, actual) })
    for (const section of chapter.sections) {
      const sectionTarget = targets.get(section.heading) ?? 0
      const sectionActual = charCount(section.content.paragraphs)
      entries.push({ heading: section.heading, targetCharCount: sectionTarget, actualCharCount: sectionActual, status: status(sectionTarget, sectionActual) })
    }
  }
  return entries
}

function addUsage(a: CompletionUsage, b: CompletionUsage): CompletionUsage {
  const cached = (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0)
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    ...(a.cachedInputTokens !== undefined || b.cachedInputTokens !== undefined ? { cachedInputTokens: cached } : {}),
  }
}

function lastKeyword(seoKeywords: string): string {
  return seoKeywords.split(/[,、，]/).map((s) => s.trim()).filter(Boolean).at(-1) ?? seoKeywords
}

export async function writeArticle(
  input: ArticleInput,
  completer: StructuredCompleter,
  options: WriteArticleOptions = {},
): Promise<WriteArticleResult> {
  const system = renderSystemPrompt({
    ...input,
    coreKeyword: input.coreKeyword ?? input.seoKeywords,
    topicKeyword: input.topicKeyword ?? lastKeyword(input.seoKeywords),
  })
  const messages: CompletionMessage[] = [{ role: "user", content: buildUserMessage(input) }]
  const maxAttempts = 1 + (options.maxRetries ?? 1)
  let usage: CompletionUsage = { inputTokens: 0, outputTokens: 0 }
  let lastErrors: string[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const request: CompletionRequest = { system, messages: [...messages], schema: ARTICLE_RESPONSE_JSON_SCHEMA, signal: options.signal }
    await options.onAttempt?.({ phase: "request", attempt, request })
    const reply = await completer.complete(request)
    usage = addUsage(usage, reply.usage)
    const parsed = parseArticle(reply.text)
    await options.onAttempt?.({ phase: "reply", attempt, text: reply.text, usage: reply.usage, errors: parsed.ok ? [] : parsed.errors })
    if (parsed.ok) {
      return {
        article: parsed.article,
        attempts: attempt,
        usage,
        lengthReport: buildLengthReport(parsed.article, input.chapters),
        provider: { id: completer.id, model: completer.model },
      }
    }
    lastErrors = parsed.errors
    messages.push(
      { role: "assistant", content: reply.text },
      {
        role: "user",
        content: [
          "前回の出力は指定のJSON形式として妥当ではありませんでした。次の問題だけを修正し、記事本文のJSONのみを再出力してください。",
          ...parsed.errors.map((e) => `- ${e}`),
        ].join("\n"),
      },
    )
  }
  throw new Error(`Provider ${completer.id} did not return a valid article after ${maxAttempts} attempts: ${lastErrors.join("; ")}`)
}
