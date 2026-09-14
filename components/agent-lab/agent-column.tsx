"use client"

import { Square, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ProviderMark } from "./provider-mark"
import { StatusPill } from "./status-pill"
import { MetricsGrid } from "./metrics-grid"
import { TimelineEventRow } from "./timeline-event"
import type {
  AgentConfig,
  AgentMetrics,
  RunStatus,
  TimelineEvent,
} from "@/lib/agent-lab-data"

export function AgentColumn({
  config,
  timeline,
  metrics,
  status,
  runningCount,
  onSelect,
  onStop,
}: {
  config: AgentConfig
  timeline: TimelineEvent[]
  metrics: AgentMetrics
  status: RunStatus
  runningCount: number
  onSelect: (e: TimelineEvent) => void
  onStop: () => void
}) {
  const isRunning = status === "running"
  const isReady = status === "ready"

  const visible = isReady
    ? []
    : isRunning
      ? timeline.slice(0, runningCount)
      : timeline

  const headerTone: RunStatus = status
  const elapsed =
    status === "completed" || status === "failed" ? metrics.duration : config.elapsed

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <ProviderMark id={config.id} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-foreground">
            {config.vendor === "OpenAI" ? "OpenAI Agent API" : "Claude Managed Agents"}
          </div>
          <div className="truncate text-xs text-muted-foreground">{config.model}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isReady && (
            <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
              <Clock className="size-3.5" />
              {elapsed}
            </span>
          )}
          <StatusPill tone={headerTone} />
          {isRunning && (
            <Button size="xs" variant="outline" onClick={onStop}>
              <Square className="size-3 fill-current" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 px-2 py-2">
        {isReady ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <div className="text-sm font-medium text-foreground">Waiting to run</div>
            <div className="text-xs text-muted-foreground">
              The execution timeline will appear here once the agent starts.
            </div>
          </div>
        ) : (
          <ol className={cn("space-y-0.5")}>
            {visible.map((event, i) => (
              <TimelineEventRow
                key={event.id}
                event={event}
                isLast={i === visible.length - 1}
                pending={isRunning && i === visible.length - 1}
                onSelect={onSelect}
              />
            ))}
          </ol>
        )}
      </div>

      {/* Metrics */}
      {!isReady && <MetricsGrid metrics={metrics} />}
    </div>
  )
}
