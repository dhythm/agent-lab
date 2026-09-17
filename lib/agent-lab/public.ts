import type { AgentRun, AgentTask, StoredFile } from "./types"
import type { TaskRecord } from "./run-store"

export type PublicFile = Pick<StoredFile, "name" | "size">

function publicFiles(files: StoredFile[] | undefined): PublicFile[] | undefined {
  return files?.map(({ name, size }) => ({ name, size }))
}

/** Strips server-side paths before a task leaves the API. */
export function toPublicTask(task: AgentTask) {
  const { systemPrompt: _systemPrompt, ...publicTask } = task
  return { ...publicTask, attachments: publicFiles(task.attachments) }
}

export function toPublicRun(run: AgentRun) {
  return {
    ...run,
    result: run.result ? { ...run.result, artifacts: publicFiles(run.result.artifacts) } : undefined,
  }
}

export function toPublicTaskRecord(record: TaskRecord) {
  return {
    task: toPublicTask(record.task),
    runs: record.runs.map(toPublicRun),
    evaluations: record.evaluations,
  }
}
