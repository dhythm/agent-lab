import { readFile } from "node:fs/promises"
import type { FileStore } from "@/lib/agent-lab/files"
import type { AgentProvider, ProviderRunHandle, ProviderRunInput, ProviderRunOutcome, ProviderRunSink } from "@/lib/agent-lab/provider"
import type { AgentTask } from "@/lib/agent-lab/types"
import { articleInputSchema, describeIssues, toArticleInput } from "@/lib/article-writer/input-schema"
import type { ArticleInput } from "@/lib/article-writer/input"
import { ARTICLE_RESPONSE_JSON_SCHEMA, parseArticle, type ParseArticleResult } from "@/lib/article-writer/schema"
import { renderTemplate, templateVariables } from "@/lib/article-writer/template"
import { buildLengthReport, type LengthReportEntry } from "@/lib/article-writer/write-article"

const ARTICLE_FILE = "article.json"
const INPUT_FILE_HINT = "Attach the writer input as a JSON file (e.g. article-input.json)."

/** Finds the writer input in the task: the first JSON attachment. */
export async function readArticleInput(task: AgentTask): Promise<ArticleInput> {
  const attachment = (task.attachments ?? []).find((a) => a.name.toLowerCase().endsWith(".json"))
  if (!attachment) throw new Error(`No article input found. ${INPUT_FILE_HINT}`)
  let json: unknown
  try {
    json = JSON.parse(await readFile(attachment.storedPath, "utf8"))
  } catch (error) {
    throw new Error(`${attachment.name} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  // Accept the /api/article request body shape too, so one file serves both entry points.
  const body = typeof json === "object" && json !== null && "input" in json ? (json as { input: unknown }).input : json
  const parsed = articleInputSchema.safeParse(body)
  if (!parsed.success) throw new Error(`${attachment.name} is not a valid article input: ${describeIssues(parsed.error)}`)
  return toArticleInput(parsed.data)
}

/** Fills the `{{...}}` placeholders of the Task text from the input. Unknown placeholders are an error. */
export function renderArticleTask(template: string, input: ArticleInput): string {
  const variables = {
    ...templateVariables({
      ...input,
      coreKeyword: input.coreKeyword ?? input.seoKeywords,
      topicKeyword: input.topicKeyword ?? input.seoKeywords.split(/[,、，]/).map((s) => s.trim()).filter(Boolean).at(-1) ?? input.seoKeywords,
    }),
    direction: input.direction.trim() || "なし",
    title: input.title,
    chapters: input.chapters,
    references: input.references,
  }
  return renderTemplate(template, variables)
}

function outputInstruction(): string {
  return [
    "",
    "---",
    "",
    "## 出力先と形式",
    `- 記事本文の JSON を、この環境の出力ディレクトリに \`${ARTICLE_FILE}\` として保存する。最終回答にも同じ JSON を返す。`,
    "- JSON は次の JSON Schema に厳密に従う。",
    "```json",
    JSON.stringify(ARTICLE_RESPONSE_JSON_SCHEMA),
    "```",
  ].join("\n")
}

function formatLengthReport(report: LengthReportEntry[]): string {
  const rows = report.map((r) => `${r.status.padEnd(5)} ${String(r.actualCharCount).padStart(5)} / ${String(r.targetCharCount).padStart(5)}  ${r.heading}`)
  return ["status actual / target  heading", ...rows].join("\n")
}

function preview(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max)}\n…(${text.length - max} more chars)` : text
}

/**
 * `article` tasks: the Task text is a prompt template, the JSON attachment holds the
 * variables. The rendered prompt goes to the wrapped sandbox provider like any other
 * task; afterwards the produced article.json (or the final answer) is validated
 * against the article schema and the length targets.
 */
export function createArticleProvider(base: AgentProvider, files: FileStore): AgentProvider {
  async function locateArticle(runId: string, outcome: ProviderRunOutcome): Promise<{ source: string; parsed: ParseArticleResult; text: string }> {
    const artifact = (outcome.result.artifacts ?? []).find((a) => a.name === ARTICLE_FILE)
    if (artifact) {
      const bytes = await files.readArtifact(runId, artifact.name)
      const text = bytes?.toString("utf8") ?? ""
      return { source: artifact.name, parsed: parseArticle(text), text }
    }
    return { source: "final output", parsed: parseArticle(outcome.result.finalOutput), text: outcome.result.finalOutput }
  }

  async function finish(input: ProviderRunInput, articleInput: ArticleInput, sink: ProviderRunSink, outcome: ProviderRunOutcome): Promise<ProviderRunOutcome> {
    const { source, parsed, text } = await locateArticle(input.runId, outcome)
    if (!parsed.ok) {
      await sink.emit({
        type: "warning",
        title: `${source} does not match the article schema`,
        detail: [...parsed.errors, "", preview(text, 1500)].join("\n"),
        timestamp: new Date().toISOString(),
      })
      return {
        ...outcome,
        result: { ...outcome.result, testResult: `JSON schema: failed (${parsed.errors.length} issue(s) in ${source})` },
      }
    }
    const artifacts = outcome.result.artifacts ?? []
    const saved = artifacts.some((a) => a.name === ARTICLE_FILE)
      ? artifacts
      : [...artifacts, await files.saveArtifact(input.runId, ARTICLE_FILE, Buffer.from(JSON.stringify(parsed.article, null, 2)))]
    const report = buildLengthReport(parsed.article, articleInput.chapters)
    const outside = report.filter((r) => r.status !== "ok").length
    await sink.emit({
      type: "success",
      title: `${source} matches the article schema`,
      detail: formatLengthReport(report),
      timestamp: new Date().toISOString(),
    })
    const chapters = parsed.article.contents.length
    const sections = parsed.article.contents.reduce((n, c) => n + c.sections.length, 0)
    return {
      ...outcome,
      result: {
        ...outcome.result,
        summary: `Generated "${parsed.article.title}": ${chapters} chapters, ${sections} sections; ${outside} heading(s) outside the target length. ${outcome.result.summary}`,
        changedFiles: [...new Set([...outcome.result.changedFiles, ARTICLE_FILE])],
        testResult: `JSON schema: passed (${source})`,
        artifacts: saved,
      },
    }
  }

  return {
    id: base.id,
    label: base.label,
    async startRun(input, sink): Promise<ProviderRunHandle> {
      if (input.task.type !== "article") return base.startRun(input, sink)

      let articleInput: ArticleInput
      let prompt: string
      try {
        articleInput = await readArticleInput(input.task)
        prompt = renderArticleTask(input.task.prompt, articleInput) + outputInstruction()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await sink.emit({ type: "error", title: "Could not render the task template", detail: message, timestamp: new Date().toISOString() })
        return { done: Promise.reject(new Error(message)), async cancel() {} }
      }
      await sink.emit({
        type: "planning",
        title: "Render the task template",
        detail: `template: ${input.task.prompt.length} chars → prompt: ${prompt.length} chars\ntitle: ${articleInput.title}\nkeywords: ${articleInput.seoKeywords}\n\n${preview(prompt.slice(prompt.indexOf("## 入力文:")))}`,
        timestamp: new Date().toISOString(),
        metadata: { tool: "template" },
      })

      const handle = await base.startRun({ ...input, task: { ...input.task, prompt } }, sink)
      return {
        done: handle.done.then((outcome) => finish(input, articleInput, sink, outcome)),
        cancel: () => handle.cancel(),
      }
    },
  }
}
