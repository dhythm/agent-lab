import type { ProviderId } from "@/lib/agent-lab/types"

export type { ProviderId }

export interface AgentConfig {
  id: ProviderId
  vendor: string
  name: string
  model: string
  environment: string
  capabilities: string[]
}

export const providerConfigs: Record<ProviderId, AgentConfig> = {
  openai: {
    id: "openai",
    vendor: "OpenAI",
    name: "Agents API",
    model: "gpt-5.6-sol",
    environment: "OpenAI-hosted sandbox",
    capabilities: ["Shell", "Files", "Web", "Tools", "Subagents"],
  },
  anthropic: {
    id: "anthropic",
    vendor: "Anthropic",
    name: "Claude Managed Agents",
    model: "claude-opus-5",
    environment: "Cloud environment",
    capabilities: ["Shell", "Files", "Web", "Tools", "Persistent session"],
  },
}

export const providerOrder: ProviderId[] = ["openai", "anthropic"]

export const evaluationCriteria: { key: EvaluationKey; label: string }[] = [
  { key: "taskCompletion", label: "Task completion" },
  { key: "speed", label: "Speed" },
  { key: "costEfficiency", label: "Cost efficiency" },
  { key: "toolEfficiency", label: "Tool efficiency" },
  { key: "recovery", label: "Recovery from failure" },
  { key: "codeQuality", label: "Code quality" },
]

export type EvaluationKey =
  | "taskCompletion"
  | "speed"
  | "costEfficiency"
  | "toolEfficiency"
  | "recovery"
  | "codeQuality"
