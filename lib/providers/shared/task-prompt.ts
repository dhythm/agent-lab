import type { AgentTask } from "@/lib/agent-lab/types"

export function normalizeRepositoryUrl(input: string | undefined): string | undefined {
  const value = input?.trim()
  if (!value) return undefined
  const url = /^https?:\/\//.test(value) ? value : `https://github.com/${value}`
  return url.replace(/\/+$/, "").replace(/\.git$/, "")
}

export function repositoryName(url: string): string {
  return url.split("/").filter(Boolean).at(-1) ?? "repo"
}

export interface TaskPromptOptions {
  workspacePath?: string
  outputDir?: string
}

const TYPE_GUIDANCE: Record<AgentTask["type"], string> = {
  coding: [
    "Work directly in the repository.",
    "Explore the code before editing, keep changes minimal, and add or update tests for the change.",
    "Run the existing tests after your change and fix any failures before finishing.",
    "Do not push, commit, or open pull requests.",
  ].join(" "),
  research: "Gather information from the web, compare the options, and write a Markdown report.",
  data: "Load the provided data, analyze it with code, and write your findings to a Markdown file.",
  general: "Complete the task as precisely as possible.",
}

export function buildTaskPrompt(task: AgentTask, options: TaskPromptOptions): string {
  const lines: string[] = [task.prompt.trim(), ""]
  const repository = normalizeRepositoryUrl(task.repository)
  if (repository) {
    const where = options.workspacePath ?? `/workspace/${repositoryName(repository)}`
    lines.push(`Repository: ${repository} (checked out at ${where}${task.branch ? `, branch ${task.branch}` : ""})`)
  }
  lines.push(TYPE_GUIDANCE[task.type])
  if (options.outputDir && task.type !== "coding") {
    lines.push(`Save any files you produce under ${options.outputDir}.`)
  }
  lines.push("When you are done, reply with a concise summary of what you changed and the test results.")
  return lines.join("\n")
}
