export type ProviderId = "openai" | "anthropic"

export type TaskType = "coding" | "research" | "data" | "general"

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type AgentEventType =
  | "planning"
  | "thinking"
  | "search"
  | "file_read"
  | "file_write"
  | "shell"
  | "tool_call"
  | "test"
  | "retry"
  | "warning"
  | "error"
  | "success"
  | "final_output"

export interface AgentTask {
  id: string
  title: string
  prompt: string
  type: TaskType
  repository?: string
  branch?: string
  createdAt: string
}

export interface AgentEvent {
  id: string
  runId: string
  provider: ProviderId
  type: AgentEventType
  title: string
  detail?: string
  timestamp: string
  durationMs?: number
  metadata?: Record<string, unknown>
}

export interface AgentMetrics {
  durationMs?: number
  steps?: number
  toolCalls?: number
  filesChanged?: number
  retries?: number
  inputTokens?: number
  outputTokens?: number
  estimatedCost?: number
}

export interface AgentResult {
  summary: string
  changedFiles: string[]
  testResult?: string
  finalOutput: string
}

export interface AgentRun {
  id: string
  taskId: string
  provider: ProviderId
  status: RunStatus
  externalId?: string
  startedAt?: string
  completedAt?: string
  events: AgentEvent[]
  result?: AgentResult
  metrics?: AgentMetrics
  error?: string
}

export interface EvaluationScore {
  taskCompletion: number
  speed: number
  costEfficiency: number
  toolEfficiency: number
  recovery: number
  codeQuality: number
}

export type NewAgentEvent = Omit<AgentEvent, "id" | "runId" | "provider">
