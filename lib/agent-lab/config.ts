import path from "node:path"

export interface AgentLabConfig {
  dataDir: string
  anthropic: {
    enabled: boolean
    model: string
    agentId?: string
    environmentId?: string
    workspace: string
  }
  openai: {
    enabled: boolean
    model: string
    inputPricePerMillion: number
    outputPricePerMillion: number
  }
  githubToken?: string
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? Number.NaN : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentLabConfig {
  return {
    dataDir: env.AGENT_LAB_DATA_DIR ?? path.join(process.cwd(), ".agent-lab"),
    anthropic: {
      enabled: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
      model: env.ANTHROPIC_AGENT_MODEL ?? "claude-opus-5",
      agentId: env.ANTHROPIC_AGENT_ID,
      environmentId: env.ANTHROPIC_ENVIRONMENT_ID,
      workspace: env.ANTHROPIC_WORKSPACE ?? "default",
    },
    openai: {
      enabled: Boolean(env.OPENAI_API_KEY),
      model: env.OPENAI_AGENT_MODEL ?? "gpt-6-astra",
      // List prices are not returned by the Agents API; override via env when they change.
      inputPricePerMillion: readNumber(env.OPENAI_INPUT_PRICE_PER_MILLION, 10),
      outputPricePerMillion: readNumber(env.OPENAI_OUTPUT_PRICE_PER_MILLION, 50),
    },
    githubToken: env.GITHUB_TOKEN,
  }
}
