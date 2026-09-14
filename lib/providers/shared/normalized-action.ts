import type { AgentEvent, NewAgentEvent } from "@/lib/agent-lab/types"

export type EventPatch = Partial<Omit<AgentEvent, "id" | "runId" | "provider">>

/**
 * A provider-agnostic instruction produced by an event normalizer.
 * `key` is the provider's own identifier for the item, used to correlate a
 * later `update` (e.g. a tool result) with the timeline event it belongs to.
 */
export type NormalizedAction =
  | { kind: "append"; key: string; event: NewAgentEvent }
  | { kind: "update"; key: string; patch: EventPatch }

export function truncate(text: string, max = 120): string {
  const single = text.replace(/\s+/g, " ").trim()
  if (single.length <= max) return single
  return `${single.slice(0, max - 1)}…`
}

const FAILURE_PATTERN = /\b(\d+\s+failed|FAIL\b|failing|error(s)?:|Error:)/i

export function looksLikeFailure(output: string | null | undefined): boolean {
  if (!output) return false
  return FAILURE_PATTERN.test(output)
}
