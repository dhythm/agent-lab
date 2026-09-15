/**
 * Prints the prompt an `article` run sends to the agent, with every {{variable}} filled.
 *
 *   npx tsx scripts/render-article-task.ts <input.json> [template.md] > rendered.md
 *
 * <input.json> is the same file you attach in the UI (text form or outline form).
 * The template defaults to the preset's Task text.
 */
import { readFileSync } from "node:fs"
import { articleInputSchema, describeIssues, toArticleInput } from "../lib/article-writer/input-schema"
import { ARTICLE_TASK_TEMPLATE } from "../lib/article-writer/template"
import { renderArticleTask } from "../lib/providers/article/provider"

const [inputPath, templatePath] = process.argv.slice(2)
if (!inputPath) {
  console.error("Usage: npx tsx scripts/render-article-task.ts <input.json> [template.md]")
  process.exit(2)
}
const raw = JSON.parse(readFileSync(inputPath, "utf8"))
const body = typeof raw === "object" && raw !== null && "input" in raw ? raw.input : raw
const parsed = articleInputSchema.safeParse(body)
if (!parsed.success) {
  console.error(`Invalid input: ${describeIssues(parsed.error)}`)
  process.exit(1)
}
const template = templatePath ? readFileSync(templatePath, "utf8") : ARTICLE_TASK_TEMPLATE
process.stdout.write(renderArticleTask(template, toArticleInput(parsed.data)) + "\n")
