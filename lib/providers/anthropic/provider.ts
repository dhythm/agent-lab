import Anthropic from "@anthropic-ai/sdk"
import type {
  AgentProvider,
  ProviderRunHandle,
  ProviderRunInput,
  ProviderRunSink,
  ProviderRunOutcome,
  ProviderUsage,
} from "@/lib/agent-lab/provider"
import type { AgentLabConfig } from "@/lib/agent-lab/config"
import { createActionApplier } from "../shared/apply-actions"
import { buildTaskPrompt, normalizeRepositoryUrl, repositoryName } from "../shared/task-prompt"
import { createResultTracker } from "../shared/result-tracker"
import { createAnthropicNormalizer } from "./normalize"
import { ensureAnthropicResources, type AnthropicResources } from "./setup"

type SessionEvent = Anthropic.Beta.Sessions.BetaManagedAgentsSessionEvent
type StreamEvent = Anthropic.Beta.Sessions.BetaManagedAgentsStreamSessionEvents

const OUTPUT_DIR = "/mnt/session/outputs"
const MAX_RECONNECTS = 5

function isPersistedEvent(event: StreamEvent): event is SessionEvent {
  return event.type !== "event_start" && event.type !== "event_delta"
}

function costFromListCost(listCost: { amount: string; currency: string } | null | undefined): number | undefined {
  if (!listCost || listCost.currency !== "USD") return undefined
  const cents = Number(listCost.amount)
  return Number.isFinite(cents) ? cents / 100 : undefined
}

export function createAnthropicProvider(config: AgentLabConfig): AgentProvider {
  const client = new Anthropic()
  let resources: Promise<AnthropicResources> | undefined

  function getResources(): Promise<AnthropicResources> {
    if (!resources) {
      resources = ensureAnthropicResources({
        client,
        model: config.anthropic.model,
        dataDir: config.dataDir,
        agentId: config.anthropic.agentId,
        environmentId: config.anthropic.environmentId,
      }).catch((error) => {
        resources = undefined
        throw error
      })
    }
    return resources
  }

  async function run(
    input: ProviderRunInput,
    sink: ProviderRunSink,
    state: { sessionId?: string; cancelled: boolean; abort?: AbortController },
  ): Promise<ProviderRunOutcome> {
    const { task } = input
    const { agentId, agentVersion, environmentId } = await getResources()
    const repository = normalizeRepositoryUrl(task.repository)
    const workspacePath = repository ? `/workspace/${repositoryName(repository)}` : undefined
    const prompt = buildTaskPrompt(task, { workspacePath, outputDir: OUTPUT_DIR })

    const session = await client.beta.sessions.create({
      agent: { type: "agent", id: agentId, version: agentVersion },
      environment_id: environmentId,
      title: task.title.slice(0, 120),
      metadata: { agent_lab_run_id: input.runId, task_type: task.type },
      resources: repository
        ? [
            {
              type: "github_repository",
              url: repository,
              mount_path: workspacePath,
              ...(config.githubToken ? { authorization_token: config.githubToken } : {}),
              ...(task.branch ? { checkout: { type: "branch", name: task.branch } } : {}),
            },
          ]
        : undefined,
      initial_events: [{ type: "user.message", content: [{ type: "text", text: prompt }] }],
    })
    state.sessionId = session.id
    await sink.setExternalId(session.id)
    console.log(
      `[anthropic] session ${session.id}: https://platform.claude.com/workspaces/${config.anthropic.workspace}/sessions/${session.id}`,
    )

    const normalize = createAnthropicNormalizer()
    const apply = createActionApplier(sink)
    const tracker = createResultTracker()
    const seen = new Set<string>()
    const usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 }
    let finished = false
    let failure: Error | undefined

    async function handle(event: SessionEvent): Promise<void> {
      if (event.id && seen.has(event.id)) return
      if (event.id) seen.add(event.id)

      if (event.type === "span.model_request_end" && event.model_usage) {
        usage.inputTokens =
          (usage.inputTokens ?? 0) +
          (event.model_usage.input_tokens ?? 0) +
          (event.model_usage.cache_creation_input_tokens ?? 0) +
          (event.model_usage.cache_read_input_tokens ?? 0)
        usage.outputTokens = (usage.outputTokens ?? 0) + (event.model_usage.output_tokens ?? 0)
      }

      const actions = normalize(event)
      tracker.observe(actions)
      await apply(actions)

      if (
        (event.type === "agent.tool_use" || event.type === "agent.mcp_tool_use") &&
        event.evaluated_permission === "ask"
      ) {
        // Agent Lab runs with always_allow; if the platform still asks, approve so the run continues.
        await client.beta.sessions.events.send(session.id, {
          events: [{ type: "user.tool_confirmation", tool_use_id: event.id, result: "allow" }],
        })
      }

      if (event.type === "session.status_terminated") finished = true
      if (event.type === "session.status_idle") {
        const reason = event.stop_reason.type
        if (reason === "requires_action") return
        if (reason === "retries_exhausted") failure = new Error("Session gave up after exhausting retries")
        if (reason === "budget_reached") failure = new Error("Session paused: budget reached")
        finished = true
      }
    }

    let attempts = 0
    while (!finished) {
      attempts += 1
      state.abort = new AbortController()
      try {
        const stream = await client.beta.sessions.events.stream(
          session.id,
          {},
          { signal: state.abort.signal },
        )
        // No replay on SSE: overlap the live stream with history and dedupe by id.
        for await (const event of client.beta.sessions.events.list(session.id)) {
          await handle(event)
        }
        if (finished) break
        for await (const event of stream) {
          if (!isPersistedEvent(event)) continue
          await handle(event)
          if (finished) break
        }
        if (!finished) {
          const current = await client.beta.sessions.retrieve(session.id)
          if (current.status === "terminated" || current.status === "idle") finished = true
        }
      } catch (error) {
        if (state.cancelled) break
        if (attempts >= MAX_RECONNECTS) throw error
        console.warn(`[anthropic] stream dropped (attempt ${attempts}), reconnecting:`, error)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
      }
    }

    if (failure) throw failure

    const finalSession = await client.beta.sessions.retrieve(session.id)
    const costUsd = costFromListCost(finalSession.usage?.list_cost)
    const sessionUsage = finalSession.usage
    if (sessionUsage?.input_tokens !== undefined) {
      usage.inputTokens =
        (sessionUsage.input_tokens ?? 0) +
        (sessionUsage.cache_read_input_tokens ?? 0) +
        (sessionUsage.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
        (sessionUsage.cache_creation?.ephemeral_1h_input_tokens ?? 0)
      usage.outputTokens = sessionUsage.output_tokens ?? usage.outputTokens
    }

    return {
      result: tracker.result(normalize.finalText()),
      usage,
      costUsd,
    }
  }

  return {
    id: "anthropic",
    label: "Claude Managed Agents",
    async startRun(input, sink): Promise<ProviderRunHandle> {
      const state: { sessionId?: string; cancelled: boolean; abort?: AbortController } = {
        cancelled: false,
      }
      const done = run(input, sink, state)
      return {
        done,
        async cancel() {
          state.cancelled = true
          if (state.sessionId) {
            try {
              await client.beta.sessions.events.send(state.sessionId, {
                events: [{ type: "user.interrupt" }],
              })
            } catch (error) {
              console.warn("[anthropic] interrupt failed:", error)
            }
          }
          state.abort?.abort()
        },
      }
    },
  }
}
