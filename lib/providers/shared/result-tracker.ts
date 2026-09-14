import type { AgentResult } from "@/lib/agent-lab/types"
import type { NormalizedAction } from "./normalized-action"
import { truncate } from "./normalized-action"

/**
 * Watches normalized actions to derive the changed-file list and the latest
 * test outcome, so providers can build an AgentResult without re-parsing.
 */
export function createResultTracker() {
  const changedFiles: string[] = []
  const testKeys = new Set<string>()
  let lastTest: { detail?: string; status?: string } | undefined

  function addPath(value: unknown): void {
    if (typeof value === "string" && value && !changedFiles.includes(value)) changedFiles.push(value)
  }

  return {
    observe(actions: NormalizedAction[]): void {
      for (const action of actions) {
        if (action.kind === "append") {
          if (action.event.type === "file_write") {
            addPath(action.event.metadata?.path)
            const paths = action.event.metadata?.paths
            if (Array.isArray(paths)) paths.forEach(addPath)
          }
          if (action.event.type === "test") {
            testKeys.add(action.key)
            lastTest = {
              detail: action.event.detail,
              status: action.event.metadata?.status as string | undefined,
            }
          }
        } else if (testKeys.has(action.key)) {
          lastTest = {
            detail: action.patch.detail ?? lastTest?.detail,
            status: (action.patch.metadata?.status as string | undefined) ?? lastTest?.status,
          }
        }
      }
    },
    result(finalOutput: string): AgentResult {
      const testResult = lastTest
        ? `${lastTest.status === "failed" ? "Failed" : "Passed"}${lastTest.detail ? `: ${truncate(lastTest.detail, 200)}` : ""}`
        : undefined
      return {
        summary: finalOutput ? truncate(finalOutput, 280) : "No final message was produced.",
        changedFiles: [...changedFiles],
        testResult,
        finalOutput,
      }
    },
  }
}
