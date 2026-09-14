"use client"

import { useState } from "react"
import { FlaskConical, History, ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentMetrics, ProviderId, RunStatus } from "@/lib/agent-lab/types"
import { formatDuration } from "@/lib/agent-lab/format"

export interface HistoryItem {
  taskId: string
  title: string
  createdAt: string
  runs: { id: string; provider: ProviderId; status: RunStatus; metrics?: AgentMetrics }[]
}

const statusColor: Record<RunStatus, string> = {
  queued: "text-zinc-500",
  running: "text-blue-600",
  completed: "text-emerald-600",
  failed: "text-red-600",
  cancelled: "text-zinc-500",
}

function summarize(runs: HistoryItem["runs"]): { status: RunStatus; duration?: number } {
  const status: RunStatus = runs.some((r) => r.status === "running" || r.status === "queued")
    ? "running"
    : runs.every((r) => r.status === "completed")
      ? "completed"
      : runs.some((r) => r.status === "failed")
        ? "failed"
        : "cancelled"
  const durations = runs.map((r) => r.metrics?.durationMs).filter((d): d is number => d !== undefined)
  return { status, duration: durations.length ? Math.max(...durations) : undefined }
}

export function TopBar({
  history,
  activeTaskId,
  onSelectTask,
  onNewTask,
}: {
  history: HistoryItem[]
  activeTaskId?: string
  onSelectTask: (taskId: string) => void
  onNewTask: () => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-zinc-900 text-white">
            <FlaskConical className="size-4" />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">Agent Lab</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Compare managed agents on real tasks
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onNewTask}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Plus className="size-3.5 text-muted-foreground" />
            New task
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <History className="size-3.5 text-muted-foreground" />
              History
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>

            {historyOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHistoryOpen(false)} />
                <div className="absolute right-0 z-50 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                    Run history
                  </div>
                  <ul className="max-h-96 overflow-y-auto p-1">
                    {history.length === 0 && (
                      <li className="px-2.5 py-3 text-xs text-muted-foreground">No runs yet</li>
                    )}
                    {history.map((item) => {
                      const s = summarize(item.runs)
                      return (
                        <li key={item.taskId}>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryOpen(false)
                              onSelectTask(item.taskId)
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-muted",
                              item.taskId === activeTaskId && "bg-muted/60",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-foreground">{item.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {new Date(item.createdAt).toLocaleString()} · {item.runs.map((r) => r.provider).join(" + ")}
                                {s.duration !== undefined && ` · ${formatDuration(s.duration)}`}
                              </span>
                            </span>
                            <span className={cn("ml-2 shrink-0 text-xs capitalize", statusColor[s.status])}>
                              {s.status}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
