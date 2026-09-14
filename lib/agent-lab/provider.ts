import type {
  AgentEvent,
  AgentResult,
  AgentTask,
  NewAgentEvent,
  ProviderId,
} from "./types"

export interface ProviderRunInput {
  runId: string
  task: AgentTask
}

export type ProviderEventPatch = Partial<Omit<AgentEvent, "id" | "runId" | "provider">>

export interface ProviderRunSink {
  emit(event: NewAgentEvent): Promise<AgentEvent>
  updateEvent(eventId: string, patch: ProviderEventPatch): Promise<AgentEvent>
  setExternalId(externalId: string): Promise<void>
}

export interface ProviderUsage {
  inputTokens?: number
  /** Portion of inputTokens served from cache (billed at a lower rate). */
  cachedInputTokens?: number
  outputTokens?: number
}

export interface ProviderRunOutcome {
  result: AgentResult
  usage?: ProviderUsage
  costUsd?: number
}

export interface ProviderRunHandle {
  /** Resolves when the provider finishes. Rejects on failure. */
  done: Promise<ProviderRunOutcome>
  /** Ask the provider to stop as soon as it safely can. */
  cancel(): Promise<void>
}

export interface AgentProvider {
  id: ProviderId
  label: string
  startRun(input: ProviderRunInput, sink: ProviderRunSink): Promise<ProviderRunHandle>
}
