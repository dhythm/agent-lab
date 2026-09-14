import type Anthropic from "@anthropic-ai/sdk"
import type { AgentEventType, NewAgentEvent } from "@/lib/agent-lab/types"
import { classifyCommand } from "../shared/classify-command"
import {
  looksLikeFailure,
  truncate,
  type NormalizedAction,
} from "../shared/normalized-action"

type SessionEvent = Anthropic.Beta.Sessions.BetaManagedAgentsSessionEvent
type ToolUseEvent = Anthropic.Beta.Sessions.BetaManagedAgentsAgentToolUseEvent
type ToolResultEvent = Anthropic.Beta.Sessions.BetaManagedAgentsAgentToolResultEvent

export interface AnthropicNormalizer {
  (event: SessionEvent): NormalizedAction[]
  /** Text of the last agent.message seen, used as the final output. */
  finalText(): string
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function textOf(content: Array<{ type: string; text?: string }> | undefined): string {
  if (!content) return ""
  return content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .filter(Boolean)
    .join("\n")
}

interface ToolMapping {
  type: AgentEventType
  title: string
  metadata: Record<string, unknown>
}

function mapToolUse(event: ToolUseEvent): ToolMapping {
  const input = event.input
  const base = { tool: event.name, input }
  switch (event.name) {
    case "bash": {
      const command = asString(input.command) ?? ""
      return {
        type: classifyCommand(command),
        title: truncate(command),
        metadata: { ...base, command },
      }
    }
    case "read": {
      const path = asString(input.path) ?? asString(input.file_path) ?? ""
      return { type: "file_read", title: path, metadata: { ...base, path } }
    }
    case "write": {
      const path = asString(input.path) ?? asString(input.file_path) ?? ""
      return {
        type: "file_write",
        title: path,
        metadata: { ...base, path, content: asString(input.content) },
      }
    }
    case "edit": {
      const path = asString(input.path) ?? asString(input.file_path) ?? ""
      return {
        type: "file_write",
        title: path,
        metadata: {
          ...base,
          path,
          oldString: asString(input.old_string),
          newString: asString(input.new_string),
        },
      }
    }
    case "grep":
    case "glob":
      return {
        type: "search",
        title: truncate(`${event.name} ${asString(input.pattern) ?? ""}`),
        metadata: base,
      }
    case "web_search":
      return {
        type: "search",
        title: truncate(`web_search ${asString(input.query) ?? ""}`),
        metadata: base,
      }
    case "web_fetch":
      return {
        type: "search",
        title: truncate(`web_fetch ${asString(input.url) ?? ""}`),
        metadata: base,
      }
    default:
      return { type: "tool_call", title: event.name, metadata: base }
  }
}

export function createAnthropicNormalizer(): AnthropicNormalizer {
  const pending = new Map<string, { type: AgentEventType; startedAt: number }>()
  let lastTestFailed = false
  let lastMessage = ""

  function append(key: string, event: NewAgentEvent): NormalizedAction {
    return { kind: "append", key, event }
  }

  function handleToolUse(event: ToolUseEvent): NormalizedAction[] {
    const mapped = mapToolUse(event)
    const actions: NormalizedAction[] = []
    if (mapped.type === "test" && lastTestFailed) {
      actions.push(
        append(`${event.id}:retry`, {
          type: "retry",
          title: "Retrying tests",
          detail: undefined,
          timestamp: event.processed_at,
          metadata: undefined,
        }),
      )
    }
    pending.set(event.id, { type: mapped.type, startedAt: Date.parse(event.processed_at) })
    actions.push(
      append(event.id, {
        type: mapped.type,
        title: mapped.title,
        detail: undefined,
        timestamp: event.processed_at,
        metadata: mapped.metadata,
      }),
    )
    return actions
  }

  function handleToolResult(event: ToolResultEvent): NormalizedAction[] {
    const started = pending.get(event.tool_use_id)
    pending.delete(event.tool_use_id)
    const output = textOf(event.content)
    const failed = Boolean(event.is_error) || (started?.type === "test" && looksLikeFailure(output))
    if (started?.type === "test") lastTestFailed = failed
    const durationMs =
      started && Number.isFinite(started.startedAt)
        ? Math.max(0, Date.parse(event.processed_at) - started.startedAt)
        : undefined
    return [
      {
        kind: "update",
        key: event.tool_use_id,
        patch: {
          detail: output || undefined,
          durationMs,
          metadata: {
            isError: Boolean(event.is_error),
            status: failed ? "failed" : "completed",
          },
        },
      },
    ]
  }

  const normalize = ((event: SessionEvent): NormalizedAction[] => {
    switch (event.type) {
      case "agent.tool_use":
        return handleToolUse(event)
      case "agent.tool_result":
        return handleToolResult(event)
      case "agent.mcp_tool_use":
        pending.set(event.id, { type: "tool_call", startedAt: Date.parse(event.processed_at) })
        return [
          append(event.id, {
            type: "tool_call",
            title: `${event.mcp_server_name ?? "mcp"}: ${event.name}`,
            detail: undefined,
            timestamp: event.processed_at,
            metadata: { tool: event.name, input: event.input },
          }),
        ]
      case "agent.mcp_tool_result":
        return handleToolResult({
          ...event,
          type: "agent.tool_result",
        } as unknown as ToolResultEvent)
      case "agent.thinking":
        return [
          append(event.id, {
            type: "thinking",
            title: "Thinking",
            detail: undefined,
            timestamp: event.processed_at,
            metadata: undefined,
          }),
        ]
      case "agent.message": {
        const text = textOf(event.content)
        if (!text) return []
        lastMessage = text
        return [
          append(event.id, {
            type: "planning",
            title: truncate(text),
            detail: text,
            timestamp: event.processed_at,
            metadata: undefined,
          }),
        ]
      }
      case "agent.thread_context_compacted":
        return [
          append(event.id, {
            type: "warning",
            title: "Context compacted",
            detail: undefined,
            timestamp: event.processed_at,
            metadata: undefined,
          }),
        ]
      case "session.error":
        return [
          append(event.id, {
            type: "error",
            title: truncate(event.error.message ?? event.error.type),
            detail: event.error.message,
            timestamp: event.processed_at,
            metadata: { errorType: event.error.type },
          }),
        ]
      case "session.status_rescheduled":
        return [
          append(event.id, {
            type: "retry",
            title: "Session rescheduled",
            detail: undefined,
            timestamp: event.processed_at,
            metadata: undefined,
          }),
        ]
      default:
        return []
    }
  }) as AnthropicNormalizer

  normalize.finalText = () => lastMessage
  return normalize
}
