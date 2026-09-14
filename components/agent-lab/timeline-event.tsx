"use client"

import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/lib/agent-lab/types"
import { formatDuration } from "@/lib/agent-lab/format"
import { eventVisuals } from "./event-visuals"

const FILE_TYPES = new Set(["file_read", "file_write"])

function statusBadge(event: AgentEvent): { text: string; failed: boolean } | undefined {
  const status = event.metadata?.status
  if (event.type === "test") {
    if (status === "failed") return { text: "failed", failed: true }
    if (status === "completed" || status === "passed") return { text: "passed", failed: false }
    return undefined
  }
  if (status === "failed") return { text: "failed", failed: true }
  const exitCode = event.metadata?.exitCode
  if (typeof exitCode === "number" && exitCode !== 0) return { text: `exit ${exitCode}`, failed: true }
  return undefined
}

export function TimelineEventRow({
  event,
  isLast,
  pending,
  onSelect,
}: {
  event: AgentEvent
  isLast: boolean
  pending?: boolean
  onSelect: (e: AgentEvent) => void
}) {
  const visual = eventVisuals[event.type]
  const Icon = visual.icon
  const badge = statusBadge(event)
  const filePath = FILE_TYPES.has(event.type) ? undefined : (event.metadata?.path as string | undefined)
  const subtitle =
    event.type === "planning" || event.type === "thinking" || event.type === "final_output"
      ? undefined
      : event.type === "error" || event.type === "warning" || event.type === "retry"
        ? event.detail
        : undefined

  return (
    <li className="relative">
      {!isLast && <span className="absolute left-[13.5px] top-7 bottom-0 w-px bg-border" />}
      <button
        type="button"
        onClick={() => onSelect(event)}
        className={cn(
          "group flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
          pending && "opacity-60",
        )}
      >
        <span
          className={cn(
            "z-10 mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border",
            visual.chip,
          )}
        >
          <Icon className="size-3.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm font-medium",
                event.type === "error" && "text-red-700",
                (event.type === "success" || event.type === "final_output") && "text-emerald-700",
                FILE_TYPES.has(event.type) && "font-mono text-[13px]",
              )}
            >
              {event.title}
              {pending && <span className="ml-1.5 font-normal text-muted-foreground">running…</span>}
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              {event.durationMs !== undefined && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatDuration(event.durationMs)}
                </span>
              )}
              {badge && (
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 font-mono text-[11px]",
                    badge.failed
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-emerald-100 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {badge.text}
                </span>
              )}
            </span>
          </span>

          {filePath && (
            <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{filePath}</span>
          )}
          {subtitle && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{subtitle}</span>
          )}
        </span>
      </button>
    </li>
  )
}
