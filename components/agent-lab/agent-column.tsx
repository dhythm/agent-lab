"use client"

import { useEffect, useRef, useState } from "react"
import { Square, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProviderMark } from "./provider-mark"
import { StatusPill } from "./status-pill"
import { MetricsGrid } from "./metrics-grid"
import { TimelineEventRow } from "./timeline-event"
import type { AgentConfig } from "@/lib/agent-lab-data"
import type { AgentEvent, AgentRun } from "@/lib/agent-lab/types"
import { formatDuration } from "@/lib/agent-lab/format"

const ACTIVE_TOOL_TYPES = new Set(["shell", "test", "search", "file_read", "file_write", "tool_call"])

function useElapsed(run: AgentRun | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now())
  const running = run?.status === "running" || run?.status === "queued"
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  if (!run?.startedAt) return undefined
  if (run.metrics?.durationMs !== undefined) return run.metrics.durationMs
  return running ? Math.max(0, now - Date.parse(run.startedAt)) : undefined
}

export function AgentColumn({
  config,
  run,
  onSelect,
  onStop,
  connectionError,
}: {
  config: AgentConfig
  run?: AgentRun
  onSelect: (e: AgentEvent) => void
  onStop: () => void
  connectionError?: string
}) {
  const status = run?.status
  const isActive = status === "running" || status === "queued"
  const elapsed = useElapsed(run)
  const events = run?.events ?? []
  const last = events.at(-1)
  const lastPending =
    isActive && last !== undefined && ACTIVE_TOOL_TYPES.has(last.type) && last.detail === undefined

  // Keep the newest step in view so a running agent needs no manual scrolling.
  const timeline = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (!isActive) return
    const list = timeline.current
    if (list) list.scrollTop = list.scrollHeight
  }, [isActive, events.length])

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <ProviderMark id={config.id} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-foreground">
            {config.vendor} {config.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {config.model}
            {run?.externalId && (
              <span className="ml-1.5 font-mono text-[11px]">
                <ExternalLink className="mr-0.5 inline size-3" />
                {run.externalId}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {elapsed !== undefined && (
            <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
              <Clock className="size-3.5" />
              {formatDuration(elapsed)}
            </span>
          )}
          <StatusPill tone={status ?? "ready"} />
          {isActive && (
            <Button size="xs" variant="outline" onClick={onStop}>
              <Square className="size-3 fill-current" />
              Stop
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 py-2">
        {!run ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <div className="text-sm font-medium text-foreground">Waiting to run</div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <div className="text-sm font-medium text-foreground">
              {isActive ? "Starting session…" : "No events recorded"}
            </div>
            {connectionError && <div className="text-xs text-muted-foreground">{connectionError}</div>}
          </div>
        ) : (
          <ol
            ref={timeline}
            className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain"
          >
            {events.map((event, i) => (
              <TimelineEventRow
                key={event.id}
                event={event}
                isLast={i === events.length - 1}
                pending={lastPending && i === events.length - 1}
                onSelect={onSelect}
              />
            ))}
          </ol>
        )}
      </div>

      {run?.error && (
        <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{run.error}</div>
      )}

      {run && <MetricsGrid metrics={run.metrics} testResult={run.result?.testResult} />}
    </div>
  )
}
