"use client"

import { useState } from "react"
import { FlaskConical, History, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { runHistory, type RunStatus } from "@/lib/agent-lab-data"

const demoStates: { value: RunStatus; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
]

export function TopBar({
  status,
  onStatusChange,
}: {
  status: RunStatus
  onStatusChange: (s: RunStatus) => void
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
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Agent Lab
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Compare managed agents on real tasks
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Demo state segmented control */}
          <div className="hidden items-center rounded-lg border border-border bg-muted/40 p-0.5 md:flex">
            {demoStates.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onStatusChange(s.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === s.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Run history */}
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
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setHistoryOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                    Run history
                  </div>
                  <ul className="p-1">
                    {runHistory.map((r) => (
                      <li key={r.title}>
                        <button
                          type="button"
                          onClick={() => setHistoryOpen(false)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-muted",
                            r.active && "bg-muted/60",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-foreground">
                              {r.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {r.agents} agents
                            </span>
                          </span>
                          <span className="ml-2 shrink-0 text-xs text-emerald-600">
                            {r.status}
                          </span>
                        </button>
                      </li>
                    ))}
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
