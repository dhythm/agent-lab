import path from "node:path"
import { loadConfig, type AgentLabConfig } from "./config"
import { createOrchestrator, type Orchestrator } from "./orchestrator"
import { createRunStore, type RunStore } from "./run-store"
import { createFileStore, type FileStore } from "./files"
import type { AgentProvider, ProviderRunHandle } from "./provider"
import type { ProviderId } from "./types"
import { createAnthropicProvider } from "@/lib/providers/anthropic/provider"
import { createOpenAIProvider } from "@/lib/providers/openai/provider"
import { createMockProvider } from "@/lib/providers/mock/provider"

export interface AgentLabService {
  config: AgentLabConfig
  store: RunStore
  files: FileStore
  orchestrator: Orchestrator
  availableProviders: ProviderId[]
}

function unavailable(id: ProviderId, label: string, reason: string): AgentProvider {
  return {
    id,
    label,
    async startRun(): Promise<ProviderRunHandle> {
      throw new Error(`${label} is not configured: ${reason}`)
    },
  }
}

function mockedProviders(): Set<ProviderId> {
  const raw = process.env.AGENT_LAB_MOCK_PROVIDERS ?? ""
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is ProviderId => s === "openai" || s === "anthropic"),
  )
}

function buildService(): AgentLabService {
  const config = loadConfig()
  const mocked = mockedProviders()
  if (mocked.has("openai")) config.openai.enabled = true
  if (mocked.has("anthropic")) config.anthropic.enabled = true
  const store = createRunStore({ dir: path.join(config.dataDir, "runs") })
  const files = createFileStore(config.dataDir)
  const providers: AgentProvider[] = [
    mocked.has("openai")
      ? createMockProvider("openai", "OpenAI Agents API (mock)", files)
      : config.openai.enabled
        ? createOpenAIProvider(config, files)
        : unavailable("openai", "OpenAI Agents API", "set OPENAI_API_KEY"),
    mocked.has("anthropic")
      ? createMockProvider("anthropic", "Claude Managed Agents (mock)", files)
      : config.anthropic.enabled
        ? createAnthropicProvider(config, files)
        : unavailable("anthropic", "Claude Managed Agents", "set ANTHROPIC_API_KEY"),
  ]
  const orchestrator = createOrchestrator({ store, providers })
  const availableProviders: ProviderId[] = []
  if (config.openai.enabled) availableProviders.push("openai")
  if (config.anthropic.enabled) availableProviders.push("anthropic")
  return { config, store, files, orchestrator, availableProviders }
}

// Keep one instance across Next.js dev hot reloads so in-flight runs and
// subscriptions survive module re-evaluation.
const globalRef = globalThis as typeof globalThis & { __agentLabService?: AgentLabService }

export function getService(): AgentLabService {
  if (!globalRef.__agentLabService) globalRef.__agentLabService = buildService()
  return globalRef.__agentLabService
}
