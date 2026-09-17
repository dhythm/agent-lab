import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
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
  system?: string
}

interface CachedAgent {
  agentId: string
  agentVersion: number
  model: string
  system: string
}

interface CacheFile {
  environmentId: string
  agents: Record<string, CachedAgent>
}

function cachePath(dataDir: string): string {
  return path.join(dataDir, "anthropic-resources.json")
}

async function readCache(dataDir: string): Promise<CacheFile | undefined> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(dataDir), "utf8")) as
      | CacheFile
      | (CachedAgent & { environmentId: string })
    if ("agents" in parsed) return parsed
    const key = agentCacheKey(parsed.model, parsed.system)
    return {
      environmentId: parsed.environmentId,
      agents: { [key]: parsed },
    }
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

function agentCacheKey(model: string, system: string): string {
  return createHash("sha256").update(`${model}\0${system}`).digest("hex")
}

let resourceLock: Promise<void> = Promise.resolve()

async function withResourceLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = resourceLock
  let release = () => {}
  resourceLock = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

/**
 * Agents and environments are persistent, versioned resources: create them once,
 * cache the IDs on disk, and reuse them for every session. Explicit IDs from the
 * environment win over the cache.
 */
export async function ensureAnthropicResources(
  options: EnsureResourcesOptions,
): Promise<AnthropicResources> {
  return withResourceLock(async () => {
    const { client, model, dataDir } = options
    const system = options.system ?? ANTHROPIC_SYSTEM_PROMPT
    const key = agentCacheKey(model, system)
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

    const explicitAgentId =
      system === ANTHROPIC_SYSTEM_PROMPT ? options.agentId : undefined
    const cachedAgent = cache?.agents[key]
    let agentId = explicitAgentId ?? cachedAgent?.agentId
    let agentVersion = cachedAgent?.agentVersion ?? 1
    if (!agentId) {
      const agent = await client.beta.agents.create({
        name: system === ANTHROPIC_SYSTEM_PROMPT ? "agent-lab" : `agent-lab-${key.slice(0, 8)}`,
        description:
          system === ANTHROPIC_SYSTEM_PROMPT
            ? "Agent Lab coding/research/data agent"
            : "Agent Lab task-specific agent",
        model: { id: model, effort: "high" as const },
        system,
        tools: AGENT_TOOLS,
      })
      agentId = agent.id
      agentVersion = agent.version
    }

    const resources: AnthropicResources = { agentId, agentVersion, environmentId, model }
    await writeCache(dataDir, {
      environmentId,
      agents: {
        ...cache?.agents,
        [key]: { agentId, agentVersion, model, system },
      },
    })
    return resources
  })
}
