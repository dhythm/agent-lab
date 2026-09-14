import type OpenAI from "openai"
import type { AgentEventType, NewAgentEvent } from "@/lib/agent-lab/types"
import { classifyCommand, parsePatchPaths } from "../shared/classify-command"
import {
  looksLikeFailure,
  truncate,
  type EventPatch,
  type NormalizedAction,
} from "../shared/normalized-action"

type SessionEvent = OpenAI.Beta.Agents.AgentSessionEvent
type OutputItem = OpenAI.Beta.Agents.AgentOutputItem
type SessionItem = OpenAI.Beta.Agents.AgentSessionItem
type CommandItem = OpenAI.Beta.Agents.AgentCommandExecutionItem

export interface OpenAINormalizerOptions {
  now?: () => Date
}

export interface OpenAINormalizer {
  (event: SessionEvent): NormalizedAction[]
  /** Text of the last final_answer message, used as the final output. */
  finalText(): string
}

function messageText(item: { content?: Array<{ type: string; text?: string }> }): string {
  return (item.content ?? [])
    .map((part) => (part.type === "output_text" ? (part.text ?? "") : ""))
    .filter(Boolean)
    .join("\n")
}

function commandMapping(item: CommandItem): {
  type: AgentEventType
  title: string
  metadata: Record<string, unknown>
} {
  const type = classifyCommand(item.command)
  const metadata: Record<string, unknown> = {
    command: item.command,
    cwd: item.cwd,
    status: item.status,
  }
  if (type === "file_write") {
    const paths = parsePatchPaths(item.command)
    return {
      type,
      title: paths[0] ?? "apply_patch",
      metadata: { ...metadata, path: paths[0], paths },
    }
  }
  return { type, title: truncate(item.command), metadata }
}

export function createOpenAINormalizer(options: OpenAINormalizerOptions = {}): OpenAINormalizer {
  const now = options.now ?? (() => new Date())
  const seen = new Map<string, AgentEventType>()
  let lastTestFailed = false
  let finalAnswer = ""

  function stamp(): string {
    return now().toISOString()
  }

  function append(key: string, event: Omit<NewAgentEvent, "timestamp">): NormalizedAction {
    return { kind: "append", key, event: { ...event, timestamp: stamp() } }
  }

  function commandEvent(item: CommandItem): NewAgentEvent {
    const mapped = commandMapping(item)
    return {
      type: mapped.type,
      title: mapped.title,
      detail: item.output ?? undefined,
      timestamp: stamp(),
      metadata: mapped.metadata,
    }
  }

  function commandDonePatch(item: CommandItem): EventPatch {
    const mapped = commandMapping(item)
    const failed =
      (item.exit_code !== null && item.exit_code !== 0) ||
      (mapped.type === "test" && looksLikeFailure(item.output))
    if (mapped.type === "test") lastTestFailed = failed
    return {
      detail: item.output ?? undefined,
      durationMs: item.duration_ms ?? undefined,
      metadata: {
        ...mapped.metadata,
        status: failed ? "failed" : item.status,
        exitCode: item.exit_code,
      },
    }
  }

  function stringify(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    if (typeof value === "string") return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  function handleItem(item: SessionItem | OutputItem, phase: "added" | "done"): NormalizedAction[] {
    const key = item.id ?? `${item.type}:${stamp()}`
    if (item.type === "command_execution") {
      const isNew = !seen.has(key)
      const actions: NormalizedAction[] = []
      if (isNew) {
        const mapped = commandMapping(item)
        if (mapped.type === "test" && lastTestFailed) {
          actions.push(append(`${key}:retry`, { type: "retry", title: "Retrying tests" }))
        }
        seen.set(key, mapped.type)
        const event = commandEvent(item)
        if (phase === "done") Object.assign(event, commandDonePatch(item))
        actions.push({ kind: "append", key, event })
        return actions
      }
      if (phase === "done") actions.push({ kind: "update", key, patch: commandDonePatch(item) })
      return actions
    }

    // All other items are emitted once, when they complete.
    if (phase !== "done" || seen.has(key)) return []
    seen.set(key, "tool_call")

    switch (item.type) {
      case "reasoning": {
        const summary = item.summary.map((s) => s.text).filter(Boolean).join("\n")
        return [
          append(key, {
            type: "thinking",
            title: summary ? truncate(summary) : "Reasoning",
            detail: summary || undefined,
          }),
        ]
      }
      case "message": {
        if (item.role !== "assistant") return []
        const text = messageText(item)
        if (!text) return []
        if (item.phase === "final_answer") {
          finalAnswer = text
          return []
        }
        return [append(key, { type: "planning", title: truncate(text), detail: text })]
      }
      case "web_search_call": {
        const action = item.action as { type?: string; query?: string; url?: string } | null
        const label = action?.query ?? action?.url ?? action?.type ?? ""
        return [
          append(key, {
            type: "search",
            title: truncate(`web_search ${label}`),
            metadata: { action: item.action },
          }),
        ]
      }
      case "function_call":
        return [
          append(key, {
            type: "tool_call",
            title: item.name,
            detail: stringify(item.arguments),
            metadata: { callId: item.call_id },
          }),
        ]
      case "mcp_call":
        return [
          append(key, {
            type: "tool_call",
            title: `${item.server_label}: ${item.name}`,
            detail: stringify(item.output),
            metadata: { arguments: item.arguments, error: item.error },
          }),
        ]
      default:
        return [append(key, { type: "tool_call", title: item.type })]
    }
  }

  const normalize = ((event: SessionEvent): NormalizedAction[] => {
    switch (event.type) {
      case "agent.session.turn.item.added":
        return handleItem(event.item, "added")
      case "agent.session.turn.item.done":
        return handleItem(event.item, "done")
      case "error":
        return [
          append(event.event_id, {
            type: "error",
            title: truncate(event.error.message),
            detail: event.error.message,
            metadata: { code: event.error.code, errorType: event.error.type },
          }),
        ]
      case "agent.session.environment.failed":
        return [
          append(event.event_id, {
            type: "error",
            title: "Environment failed",
            metadata: { environment: event.environment },
          }),
        ]
      case "agent.session.turn.failed":
        return [
          append(event.event_id, {
            type: "error",
            title: event.turn.error?.message ? truncate(event.turn.error.message) : "Turn failed",
            detail: event.turn.error?.message ?? undefined,
          }),
        ]
      case "agent.session.subagent.created":
        return [append(event.event_id, { type: "tool_call", title: "Subagent created" })]
      default:
        return []
    }
  }) as OpenAINormalizer

  normalize.finalText = () => finalAnswer
  return normalize
}
