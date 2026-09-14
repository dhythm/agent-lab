import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type Anthropic from "@anthropic-ai/sdk"

export const ANTHROPIC_SYSTEM_PROMPT = [
  "You are a senior software engineer working inside an isolated sandbox for Agent Lab, a tool that observes how managed agents work.",
  "Explain briefly what you are about to do before each major step so the observer can follow your plan.",
  "Prefer small, verifiable steps: inspect first, change second, verify with tests third.",
  "Never push, commit, or open pull requests. Never print secrets.",
].join("\n")

export interface AnthropicResources {
  agentId: string
  agentVersion: number
  environmentId: string
  model: string
}

export interface EnsureResourcesOptions {
  client: Anthropic
  model: string
  dataDir: string
  agentId?: string
  environmentId?: string
}

interface CacheFile {
  agentId: string
  agentVersion: number
  environmentId: string
  model: string
  system: string
}

function cachePath(dataDir: string): string {
  return path.join(dataDir, "anthropic-resources.json")
}

async function readCache(dataDir: string): Promise<CacheFile | undefined> {
  try {
    return JSON.parse(await readFile(cachePath(dataDir), "utf8")) as CacheFile
  } catch {
    return undefined
  }
}

async function writeCache(dataDir: string, cache: CacheFile): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await writeFile(cachePath(dataDir), JSON.stringify(cache, null, 2), "utf8")
}

const AGENT_TOOLS: Anthropic.Beta.Agents.AgentCreateParams["tools"] = [
  {
    type: "agent_toolset_20260401",
    default_config: { enabled: true, permission_policy: { type: "always_allow" } },
  },
]

/**
 * Agents and environments are persistent, versioned resources: create them once,
 * cache the IDs on disk, and reuse them for every session. Explicit IDs from the
 * environment win over the cache.
 */
export async function ensureAnthropicResources(
  options: EnsureResourcesOptions,
): Promise<AnthropicResources> {
  const { client, model, dataDir } = options
  const cache = await readCache(dataDir)

  let environmentId = options.environmentId ?? cache?.environmentId
  if (!environmentId) {
    const environment = await client.beta.environments.create({
      name: "agent-lab",
      description: "Agent Lab sandbox (cloud, unrestricted networking)",
      config: { type: "cloud", networking: { type: "unrestricted" } },
    })
    environmentId = environment.id
  }

  let agentId = options.agentId ?? cache?.agentId
  let agentVersion = cache?.agentVersion ?? 1
  const modelParam = { id: model, effort: "high" as const }
  if (!agentId) {
    const agent = await client.beta.agents.create({
      name: "agent-lab",
      description: "Agent Lab coding/research/data agent",
      model: modelParam,
      system: ANTHROPIC_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
    })
    agentId = agent.id
    agentVersion = agent.version
  } else if (
    !options.agentId &&
    cache &&
    (cache.model !== model || cache.system !== ANTHROPIC_SYSTEM_PROMPT)
  ) {
    const agent = await client.beta.agents.update(agentId, {
      model: modelParam,
      system: ANTHROPIC_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
    })
    agentVersion = agent.version
  }

  const resources: AnthropicResources = { agentId, agentVersion, environmentId, model }
  await writeCache(dataDir, { ...resources, system: ANTHROPIC_SYSTEM_PROMPT })
  return resources
}
