import type { AgentEvent, AgentMetrics, AgentRun } from "./types"

const TOOL_EVENT_TYPES = new Set<AgentEvent["type"]>([
  "search",
  "file_read",
  "file_write",
  "shell",
  "tool_call",
  "test",
])

interface UsageMetadata {
  inputTokens?: number
  outputTokens?: number
}

function readUsage(event: AgentEvent): UsageMetadata | undefined {
  const usage = event.metadata?.usage
  if (!usage || typeof usage !== "object") return undefined
  return usage as UsageMetadata
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function sumTokens(
  events: AgentEvent[],
  key: keyof UsageMetadata,
): number | undefined {
  let total: number | undefined
  for (const event of events) {
    const value = readNumber(readUsage(event)?.[key])
    if (value === undefined) continue
    total = (total ?? 0) + value
  }
  return total
}

function lastCost(events: AgentEvent[]): number | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const cost = readNumber(events[i].metadata?.costUsd)
    if (cost !== undefined) return cost
  }
  return undefined
}

function durationMs(run: Pick<AgentRun, "startedAt" | "completedAt">): number | undefined {
  if (!run.startedAt || !run.completedAt) return undefined
  const ms = Date.parse(run.completedAt) - Date.parse(run.startedAt)
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined
}

export function computeMetrics(run: AgentRun): AgentMetrics {
  const events = run.events
  const changed = new Set<string>()
  let toolCalls = 0
  let retries = 0
  for (const event of events) {
    if (TOOL_EVENT_TYPES.has(event.type)) toolCalls += 1
    if (event.type === "retry") retries += 1
    if (event.type === "file_write") {
      const filePath = event.metadata?.path
      if (typeof filePath === "string" && filePath) changed.add(filePath)
    }
  }
  for (const artifact of run.result?.artifacts ?? []) {
    if (![...changed].some((p) => p.endsWith(`/${artifact.name}`) || p === artifact.name)) {
      changed.add(artifact.name)
    }
  }
  return {
    durationMs: durationMs(run),
    steps: events.length,
    toolCalls,
    filesChanged: changed.size,
    retries,
    inputTokens: sumTokens(events, "inputTokens"),
    outputTokens: sumTokens(events, "outputTokens"),
    estimatedCost: lastCost(events),
  }
}
