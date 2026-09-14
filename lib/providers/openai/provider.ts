import OpenAI from "openai"
import type {
  AgentProvider,
  ProviderRunHandle,
  ProviderRunInput,
  ProviderRunOutcome,
  ProviderRunSink,
  ProviderUsage,
} from "@/lib/agent-lab/provider"
import type { AgentLabConfig } from "@/lib/agent-lab/config"
import { createActionApplier } from "../shared/apply-actions"
import { buildTaskPrompt, normalizeRepositoryUrl, repositoryName } from "../shared/task-prompt"
import { createResultTracker } from "../shared/result-tracker"
import { createOpenAINormalizer } from "./normalize"

type SessionEvent = OpenAI.Beta.Agents.AgentSessionEvent
type TokenUsage = OpenAI.Beta.Agents.TokenUsage

const OUTPUT_DIR = "/workspace/outputs"

export const OPENAI_INSTRUCTIONS = [
  "You are a senior software engineer working inside an isolated sandbox for Agent Lab, a tool that observes how managed agents work.",
  "Explain briefly what you are about to do before each major step so the observer can follow your plan.",
  "Prefer small, verifiable steps: inspect first, change second, verify with tests third.",
  "Never push, commit, or open pull requests. Never print secrets.",
].join("\n")

function cloneCommand(repository: string, branch: string | undefined, token: string | undefined): string {
  const url = token
    ? repository.replace("https://github.com/", `https://x-access-token:${token}@github.com/`)
    : repository
  const branchFlag = branch ? ` --branch ${JSON.stringify(branch)}` : ""
  return `git clone --depth 1${branchFlag} ${JSON.stringify(`${url}.git`)} ${JSON.stringify(repositoryName(repository))}`
}

function toUsage(usage: TokenUsage | null | undefined): ProviderUsage | undefined {
  if (!usage) return undefined
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
}

function estimateCost(usage: ProviderUsage | undefined, config: AgentLabConfig): number | undefined {
  if (!usage) return undefined
  const input = ((usage.inputTokens ?? 0) / 1_000_000) * config.openai.inputPricePerMillion
  const output = ((usage.outputTokens ?? 0) / 1_000_000) * config.openai.outputPricePerMillion
  return Math.round((input + output) * 10_000) / 10_000
}

export function createOpenAIProvider(config: AgentLabConfig): AgentProvider {
  const client = new OpenAI()

  async function run(
    input: ProviderRunInput,
    sink: ProviderRunSink,
    state: { sessionId?: string; cancelled: boolean; abort?: () => void },
  ): Promise<ProviderRunOutcome> {
    const { task } = input
    const repository = normalizeRepositoryUrl(task.repository)
    const workspacePath = repository ? `/workspace/${repositoryName(repository)}` : undefined
    const prompt = buildTaskPrompt(task, { workspacePath, outputDir: OUTPUT_DIR })

    const normalize = createOpenAINormalizer()
    const apply = createActionApplier(sink)
    const tracker = createResultTracker()
    let usage: ProviderUsage | undefined
    let finished = false
    let failure: Error | undefined

    async function handle(event: SessionEvent): Promise<void> {
      if (event.type === "agent.session.created" && !state.sessionId) {
        state.sessionId = event.session.id
        await sink.setExternalId(event.session.id)
        console.log(`[openai] session ${event.session.id}`)
      }
      const actions = normalize(event)
      tracker.observe(actions)
      await apply(actions)

      switch (event.type) {
        case "agent.session.turn.completed":
          usage = toUsage(event.usage) ?? usage
          finished = true
          break
        case "agent.session.turn.cancelled":
          usage = toUsage(event.usage) ?? usage
          finished = true
          break
        case "agent.session.turn.failed":
          usage = toUsage(event.usage) ?? usage
          failure = new Error(event.turn.error?.message ?? "Turn failed")
          finished = true
          break
        case "agent.session.failed":
          failure = new Error(event.session.error ?? "Session failed")
          finished = true
          break
        case "agent.session.requires_action":
          failure = new Error("Session requires a client tool result, which Agent Lab does not provide")
          finished = true
          break
        case "error":
          failure = new Error(event.error.message)
          finished = true
          break
        default:
          break
      }
    }

    const stream = await client.beta.agents.sessions.create({
      agent: {
        model: config.openai.model,
        instructions: OPENAI_INSTRUCTIONS,
        reasoning: { effort: "high", summary: "auto" },
      },
      environment: {
        type: "openai_hosted",
        network: { access: "enabled" },
        setup_commands: repository
          ? [{ command: cloneCommand(repository, task.branch, config.githubToken), cwd: "/workspace" }]
          : undefined,
      },
      input: prompt,
      metadata: { agent_lab_run_id: input.runId, task_type: task.type },
      stream: true,
    })
    state.abort = () => stream.controller.abort()

    try {
      for await (const event of stream) {
        await handle(event)
        if (finished) break
      }
    } catch (error) {
      if (!state.cancelled && !finished) {
        // Streams do not replay. Recover from the saved items instead.
        console.warn("[openai] stream dropped, recovering from saved items:", error)
        await recover()
      }
    } finally {
      stream.controller.abort()
    }

    if (!finished && !state.cancelled) await recover()

    async function recover(): Promise<void> {
      if (!state.sessionId) throw new Error("OpenAI session was never created")
      for (let i = 0; i < 600 && !finished; i += 1) {
        const session = await client.beta.agents.sessions.retrieve(state.sessionId)
        if (session.status === "idle" || session.status === "failed" || session.status === "requires_action") {
          for await (const item of client.beta.agents.sessions.items.list(state.sessionId, { order: "asc" })) {
            await handle({
              type: "agent.session.turn.item.done",
              event_id: `recovered_${item.id ?? i}`,
              item,
              output_index: 0,
              session_id: state.sessionId,
              turn_id: null,
            } as SessionEvent)
          }
          usage = toUsage(session.usage) ?? usage
          if (session.status === "failed") failure = new Error(session.error ?? "Session failed")
          finished = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    if (failure) throw failure

    if (state.sessionId) {
      try {
        const session = await client.beta.agents.sessions.retrieve(state.sessionId)
        usage = toUsage(session.usage) ?? usage
        for await (const artifact of client.beta.agents.sessions.artifacts.list(state.sessionId)) {
          tracker.observe([
            {
              kind: "append",
              key: `artifact_${artifact.id}`,
              event: {
                type: "file_write",
                title: artifact.path ?? artifact.id,
                timestamp: new Date().toISOString(),
                metadata: { path: artifact.path ?? artifact.id },
              },
            },
          ])
        }
      } catch (error) {
        console.warn("[openai] post-run lookup failed:", error)
      }
    }

    return {
      result: tracker.result(normalize.finalText()),
      usage,
      costUsd: estimateCost(usage, config),
    }
  }

  return {
    id: "openai",
    label: "OpenAI Agents API",
    async startRun(input, sink): Promise<ProviderRunHandle> {
      const state: { sessionId?: string; cancelled: boolean; abort?: () => void } = {
        cancelled: false,
      }
      const done = run(input, sink, state)
      return {
        done,
        async cancel() {
          state.cancelled = true
          if (state.sessionId) {
            try {
              await client.beta.agents.sessions.events.create(state.sessionId, {
                events: [{ type: "agent.session.input.cancel" }],
              })
            } catch (error) {
              console.warn("[openai] cancel failed:", error)
            }
          }
          state.abort?.()
        },
      }
    },
  }
}
