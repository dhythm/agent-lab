"use client"

import { useRef, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { TopBar } from "@/components/agent-lab/top-bar"
import { TaskInput } from "@/components/agent-lab/task-input"
import { AgentSetup } from "@/components/agent-lab/agent-setup"
import { AgentColumn } from "@/components/agent-lab/agent-column"
import { ResultComparison } from "@/components/agent-lab/result-comparison"
import { Evaluation } from "@/components/agent-lab/evaluation"
import { EventDrawer } from "@/components/agent-lab/event-drawer"
import {
  openaiConfig,
  claudeConfig,
  openaiMetrics,
  claudeMetrics,
  openaiTimeline,
  claudeTimeline,
  type RunStatus,
  type TimelineEvent,
} from "@/lib/agent-lab-data"

export default function Page() {
  const [status, setStatus] = useState<RunStatus>("completed")
  const [selected, setSelected] = useState<TimelineEvent | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleRun() {
    if (timer.current) clearTimeout(timer.current)
    setStatus("running")
    timer.current = setTimeout(() => setStatus("completed"), 4000)
  }

  function handleStop() {
    if (timer.current) clearTimeout(timer.current)
    setStatus("completed")
  }

  const showComparison = status === "completed"
  const showFailed = status === "failed"

  return (
    <div className="min-h-screen bg-[#fafafa] text-foreground">
      <TopBar status={status} onStatusChange={setStatus} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6">
        {/* 1. Task input */}
        <TaskInput />

        {/* 2. Agent selection & run */}
        <AgentSetup status={status} onRun={handleRun} />

        {/* 3. Execution comparison */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Execution comparison
            </h2>
            <span className="text-xs text-muted-foreground">
              Click any step to inspect the underlying tool call
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AgentColumn
              config={openaiConfig}
              timeline={openaiTimeline}
              metrics={openaiMetrics}
              status={status}
              runningCount={7}
              onSelect={setSelected}
              onStop={handleStop}
            />
            <AgentColumn
              config={claudeConfig}
              timeline={claudeTimeline}
              metrics={claudeMetrics}
              status={status}
              runningCount={9}
              onSelect={setSelected}
              onStop={handleStop}
            />
          </div>
        </section>

        {/* 4. Result comparison + evaluation */}
        {showFailed && (
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-medium text-red-700">Run failed</div>
              <div className="text-xs text-red-600/80">
                One or more agents did not complete the task. Review the execution
                timeline above for the failing step.
              </div>
            </div>
          </div>
        )}

        {showComparison && (
          <>
            <ResultComparison />
            <Evaluation />
          </>
        )}
      </main>

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
