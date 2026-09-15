import { readFile } from "node:fs/promises"
import type { FileStore } from "@/lib/agent-lab/files"
import type { AgentProvider, ProviderRunHandle, ProviderRunInput, ProviderRunOutcome, ProviderRunSink } from "@/lib/agent-lab/provider"
import type { AgentTask } from "@/lib/agent-lab/types"
import { articleInputSchema, describeIssues, toArticleInput } from "@/lib/article-writer/input-schema"
import type { ArticleInput } from "@/lib/article-writer/input"
import { writeArticle, type LengthReportEntry, type StructuredCompleter } from "@/lib/article-writer/write-article"

const INPUT_FILE_HINT = "Attach the writer input as a JSON file (e.g. article-input.json) or paste the JSON into the task field."

async function readCandidates(task: AgentTask): Promise<{ source: string; text: string }[]> {
  const candidates: { source: string; text: string }[] = []
  for (const attachment of task.attachments ?? []) {
    if (!attachment.name.toLowerCase().endsWith(".json")) continue
    candidates.push({ source: attachment.name, text: await readFile(attachment.storedPath, "utf8") })
  }
  if (candidates.length === 0 && task.prompt.trim().startsWith("{")) {
    candidates.push({ source: "task", text: task.prompt })
  }
  return candidates
}

/** Finds the writer input in the task: the first JSON attachment, or the task text when it is JSON. */
export async function readArticleInput(task: AgentTask): Promise<ArticleInput> {
  const candidates = await readCandidates(task)
  if (candidates.length === 0) throw new Error(`No article input found. ${INPUT_FILE_HINT}`)
  const { source, text } = candidates[0]
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(`${source} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  // Accept the API request body shape too, so the same file works for curl and the UI.
  const body = typeof json === "object" && json !== null && "input" in json ? (json as { input: unknown }).input : json
  const parsed = articleInputSchema.safeParse(body)
  if (!parsed.success) throw new Error(`${source} is not a valid article input: ${describeIssues(parsed.error)}`)
  return toArticleInput(parsed.data)
}

function formatLengthReport(report: LengthReportEntry[]): string {
  const rows = report.map((r) => `${r.status === "ok" ? "ok   " : r.status.padEnd(5)} ${String(r.actualCharCount).padStart(5)} / ${String(r.targetCharCount).padStart(5)}  ${r.heading}`)
  return ["status actual / target  heading", ...rows].join("\n")
}

function preview(text: string, max = 1200): string {
  return text.length > max ? `${text.slice(0, max)}\n…(${text.length - max} more chars)` : text
}

export type CompleterFactory = () => StructuredCompleter

export interface ArticleProviderOptions {
  estimateCost?: (usage: ProviderRunOutcome["usage"]) => number | undefined
}

/**
 * Routes `article` tasks to a single structured-output call (template + input → JSON)
 * and everything else to the wrapped sandbox provider. The attempts, validation
 * errors and retry show up in the timeline like any other run.
 */
export function createArticleProvider(
  base: AgentProvider,
  makeCompleter: CompleterFactory,
  files: FileStore,
  options: ArticleProviderOptions = {},
): AgentProvider {
  async function run(input: ProviderRunInput, sink: ProviderRunSink, abort: AbortController): Promise<ProviderRunOutcome> {
    const completer = makeCompleter()
    await sink.setExternalId(`article_${completer.id}_${input.runId.slice(-6)}`)
    let articleInput: ArticleInput
    try {
      articleInput = await readArticleInput(input.task)
    } catch (error) {
      await sink.emit({ type: "error", title: "Invalid article input", detail: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() })
      throw error
    }

    let requestEventId: string | undefined
    let startedAt = 0
    const result = await writeArticle(articleInput, completer, {
      signal: abort.signal,
      async onAttempt(info) {
        if (info.phase === "request") {
          if (info.attempt === 1) {
            await sink.emit({
              type: "planning",
              title: "Render the writer template",
              detail: `model: ${completer.model}\nsystem: ${info.request.system.length} chars (cached prefix)\ntitle: ${articleInput.title}\nkeywords: ${articleInput.seoKeywords}\n\n${preview(info.request.messages[0].content, 2000)}`,
              timestamp: new Date().toISOString(),
              metadata: { tool: "template", model: completer.model },
            })
          }
          startedAt = Date.now()
          const event = await sink.emit({
            type: "tool_call",
            title: info.attempt === 1 ? "Structured output request" : `Structured output request (attempt ${info.attempt})`,
            detail: preview(info.request.messages.at(-1)?.content ?? ""),
            timestamp: new Date().toISOString(),
            metadata: { tool: "structured_output", model: completer.model, attempt: info.attempt, status: "running" },
          })
          requestEventId = event.id
          return
        }
        const ok = info.errors.length === 0
        if (requestEventId) {
          await sink.updateEvent(requestEventId, {
            detail: preview(info.text, 4000),
            durationMs: Date.now() - startedAt,
            // `usage` is reserved: metrics sums metadata.usage across events, and the run total lands on final_output.
            metadata: { status: ok ? "completed" : "failed", attemptUsage: info.usage },
          })
        }
        if (!ok) {
          await sink.emit({
            type: "retry",
            title: "Reply failed validation, retrying with the errors",
            detail: info.errors.join("\n"),
            timestamp: new Date().toISOString(),
          })
        }
      },
    })

    const json = JSON.stringify(result.article, null, 2)
    const artifact = await files.saveArtifact(input.runId, "article.json", Buffer.from(json))
    await sink.emit({ type: "file_write", title: "article.json", detail: preview(json, 4000), timestamp: new Date().toISOString(), metadata: { tool: "write", path: artifact.name, status: "completed" } })
    const report = formatLengthReport(result.lengthReport)
    const short = result.lengthReport.filter((r) => r.status !== "ok").length
    await sink.emit({ type: "success", title: "Article validated against the JSON schema", detail: report, timestamp: new Date().toISOString() })

    const chapters = result.article.contents.length
    const sections = result.article.contents.reduce((n, c) => n + c.sections.length, 0)
    return {
      result: {
        summary: `Generated "${result.article.title}": ${chapters} chapters, ${sections} sections in ${result.attempts} attempt(s); ${short} heading(s) outside the target length.`,
        changedFiles: [artifact.name],
        finalOutput: json,
        artifacts: [artifact],
      },
      usage: result.usage,
      costUsd: options.estimateCost?.(result.usage),
    }
  }

  return {
    id: base.id,
    label: base.label,
    async startRun(input, sink): Promise<ProviderRunHandle> {
      if (input.task.type !== "article") return base.startRun(input, sink)
      const abort = new AbortController()
      const done = run(input, sink, abort)
      return {
        done,
        async cancel() {
          abort.abort()
        },
      }
    },
  }
}
