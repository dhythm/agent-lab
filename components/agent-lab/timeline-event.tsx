"use client"

import { cn } from "@/lib/utils"
import type { TimelineEvent } from "@/lib/agent-lab-data"
import { eventVisuals } from "./event-visuals"

export function TimelineEventRow({
  event,
  isLast,
  pending,
  onSelect,
}: {
  event: TimelineEvent
  isLast: boolean
  pending?: boolean
  onSelect: (e: TimelineEvent) => void
}) {
  const visual = eventVisuals[event.type]
  const Icon = visual.icon
  const metaFailed = event.meta?.toLowerCase().includes("fail")

  return (
    <li className="relative">
      {!isLast && (
        <span className="absolute left-[13.5px] top-7 bottom-0 w-px bg-border" />
      )}
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
                event.type === "test-failure" ? "text-red-700" : "text-foreground",
                event.type === "success" && "text-emerald-700",
              )}
            >
              {event.title}
              {pending && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  running…
                </span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              {event.diff && (
                <span className="font-mono text-xs">
                  <span className="text-emerald-600">+{event.diff.added}</span>{" "}
                  <span className="text-red-500">-{event.diff.removed}</span>
                </span>
              )}
              {event.meta && (
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 font-mono text-[11px]",
                    metaFailed
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-emerald-100 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {event.meta}
                </span>
              )}
            </span>
          </span>

          {event.filename && (
            <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
              {event.filename}
            </span>
          )}
          {event.subtitle && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {event.subtitle}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
