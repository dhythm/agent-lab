"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Play, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TopBar, type HistoryItem } from "@/components/agent-lab/top-bar"
import {
  TaskInput,
  DEFAULT_TASK_FORM,
  type AttachmentSummary,
  type TaskFormValue,
} from "@/components/agent-lab/task-input"
import { findPreset } from "@/lib/agent-lab/presets"
import { userPromptFromArticleJson } from "@/lib/article-writer/input-schema"
import { AgentSetup, type ProviderAvailability } from "@/components/agent-lab/agent-setup"
import { AgentColumn } from "@/components/agent-lab/agent-column"
import { ResultComparison } from "@/components/agent-lab/result-comparison"
import { Evaluation, EMPTY_SCORE, isComplete } from "@/components/agent-lab/evaluation"
import { EventDrawer } from "@/components/agent-lab/event-drawer"
import { useRunStream } from "@/hooks/use-run-stream"
import { providerConfigs, providerOrder, type EvaluationKey } from "@/lib/agent-lab-data"
import type { AgentEvent, AgentRun, AgentTask, EvaluationScore, ProviderId } from "@/lib/agent-lab/types"
import type { TaskRecord } from "@/lib/agent-lab/run-store"

const TERMINAL = new Set(["completed", "failed", "cancelled"])

interface ActiveTask {
  task: AgentTask & { attachments?: AttachmentSummary[] }
  runIds: Partial<Record<ProviderId, string>>
  initialRuns: Partial<Record<ProviderId, AgentRun>>
  evaluations: Partial<Record<ProviderId, EvaluationScore>>
  savedEvaluations: Partial<Record<ProviderId, boolean>>
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? response.statusText
  } catch {
    return response.statusText
  }
}

export default function Page() {
  const [form, setForm] = useState<TaskFormValue>(DEFAULT_TASK_FORM)
  const [selected, setSelected] = useState<ProviderId[]>(["openai", "anthropic"])
  const [availability, setAvailability] = useState<Partial<Record<ProviderId, ProviderAvailability>>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [active, setActive] = useState<ActiveTask | undefined>()
  const [selectedEvent, setSelectedEvent] = useState<AgentEvent | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  // The form is only needed while composing; collapse it so the timelines own the viewport.
  const [setupOpen, setSetupOpen] = useState(true)

  const openai = useRunStream(active?.runIds.openai, active?.initialRuns.openai)
  const anthropic = useRunStream(active?.runIds.anthropic, active?.initialRuns.anthropic)
  const runs = useMemo(
    () => ({ openai: openai.run, anthropic: anthropic.run }) as Partial<Record<ProviderId, AgentRun>>,
    [openai.run, anthropic.run],
  )

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/runs")
      if (!response.ok) return
      const body = (await response.json()) as { tasks: { task: AgentTask; runs: HistoryItem["runs"] }[] }
      setHistory(
        body.tasks.map((t) => ({ taskId: t.task.id, title: t.task.title, createdAt: t.task.createdAt, runs: t.runs })),
      )
    } catch (e) {
      console.error("history load failed", e)
    }
  }, [])

  useEffect(() => {
    void refreshHistory()
    const taskId = new URLSearchParams(window.location.search).get("task")
    if (taskId) void handleSelectTask(taskId)
    fetch("/api/config")
      .then((r) => r.json())
      .then((body: { providers: Record<ProviderId, ProviderAvailability> }) => {
        setAvailability(body.providers)
        setSelected(providerOrder.filter((id) => body.providers[id]?.enabled))
      })
      .catch((e) => console.error("config load failed", e))
  }, [refreshHistory])

  useEffect(() => {
    setSetupOpen(active === undefined)
  }, [active])

  const anyActive = providerOrder.some((id) => {
    const status = runs[id]?.status
    return status === "running" || status === "queued"
  })
  const allSettled = active !== undefined && !anyActive && providerOrder.some((id) => runs[id])

  useEffect(() => {
    if (allSettled) void refreshHistory()
  }, [allSettled, refreshHistory])

  async function handleRun() {
    setError(undefined)
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("task", form.task)
      if (form.repository) formData.set("repository", form.repository)
      if (form.branch) formData.set("branch", form.branch)
      formData.set("type", form.type)
      for (const provider of selected) formData.append("providers", provider)
      for (const file of form.files) formData.append("files", file)
      const response = await fetch("/api/runs", { method: "POST", body: formData })
      if (!response.ok) throw new Error(await readError(response))
      const body = (await response.json()) as { task: AgentTask; runs: { id: string; provider: ProviderId }[] }
      const runIds: Partial<Record<ProviderId, string>> = {}
      for (const run of body.runs) runIds[run.provider] = run.id
      setActive({ task: body.task, runIds, initialRuns: {}, evaluations: {}, savedEvaluations: {} })
      window.history.replaceState(null, "", `?task=${body.task.id}`)
      void refreshHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStop(id: ProviderId) {
    const runId = active?.runIds[id]
    if (!runId) return
    const response = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" })
    if (!response.ok) setError(await readError(response))
  }

  async function handleSelectTask(taskId: string) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      if (!response.ok) throw new Error(await readError(response))
      const record = (await response.json()) as TaskRecord
      const runIds: Partial<Record<ProviderId, string>> = {}
      const initialRuns: Partial<Record<ProviderId, AgentRun>> = {}
      const evaluations: Partial<Record<ProviderId, EvaluationScore>> = {}
      const savedEvaluations: Partial<Record<ProviderId, boolean>> = {}
      for (const run of record.runs) {
        runIds[run.provider] = run.id
        initialRuns[run.provider] = run
        if (record.evaluations[run.id]) {
          evaluations[run.provider] = record.evaluations[run.id]
          savedEvaluations[run.provider] = true
        }
      }
      setForm({
        task: record.task.prompt,
        repository: record.task.repository ?? "",
        branch: record.task.branch ?? "",
        type: record.task.type,
        files: [],
      })
      setSelected(record.runs.map((r) => r.provider))
      setActive({ task: record.task, runIds, initialRuns, evaluations, savedEvaluations })
      window.history.replaceState(null, "", `?task=${record.task.id}`)
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task")
    }
  }

  async function handlePreset(presetId: string) {
    const preset = findPreset(presetId)
    if (!preset) return
    let files: File[] = []
    let task = preset.prompt
    try {
      const [loadedFiles, loadedTask] = await Promise.all([
        Promise.all((preset.samples ?? []).map(async (sample) => {
          const response = await fetch(sample.url)
          if (!response.ok) throw new Error(`Failed to load ${sample.name}`)
          return new File([await response.blob()], sample.name)
        })),
        preset.promptUrl
          ? fetch(preset.promptUrl).then((response) => {
              if (!response.ok) throw new Error("Failed to load preset user input")
              return response.text()
            })
          : Promise.resolve(preset.prompt),
      ])
      files = loadedFiles
      task = loadedTask
      if (preset.type === "article") {
        const jsonFile = files.find((file) => file.name.toLowerCase().endsWith(".json"))
        if (jsonFile) task = userPromptFromArticleJson(JSON.parse(await jsonFile.text()))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample files")
      return
    }
    setForm({
      task,
      repository: preset.repository ?? "",
      branch: preset.repository ? "main" : "",
      type: preset.type,
      files,
      presetId,
    })
  }

  function handleNewTask() {
    setActive(undefined)
    setForm(DEFAULT_TASK_FORM)
    setError(undefined)
    window.history.replaceState(null, "", window.location.pathname)
  }

  async function handleScore(provider: ProviderId, key: EvaluationKey, value: number) {
    if (!active) return
    const runId = active.runIds[provider]
    if (!runId) return
    const next: EvaluationScore = { ...(active.evaluations[provider] ?? EMPTY_SCORE), [key]: value }
    setActive((current) =>
      current && {
        ...current,
        evaluations: { ...current.evaluations, [provider]: next },
        savedEvaluations: { ...current.savedEvaluations, [provider]: false },
      },
    )
    if (!isComplete(next)) return // saved automatically once every criterion is scored
    const response = await fetch(`/api/runs/${runId}/evaluation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
    if (!response.ok) {
      setError(await readError(response))
      return
    }
    setActive((current) =>
      current && { ...current, savedEvaluations: { ...current.savedEvaluations, [provider]: true } },
    )
  }

  const failed = providerOrder.filter((id) => runs[id]?.status === "failed")
  const showComparison = allSettled
  const evaluable = providerOrder.filter((id) => runs[id] && TERMINAL.has(runs[id]!.status))

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#fafafa] text-foreground">
      <TopBar
        history={history}
        activeTaskId={active?.task.id}
        onSelectTask={handleSelectTask}
        onNewTask={handleNewTask}
      />

      <main className="mx-auto flex w-full min-h-0 max-w-[1400px] flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        <div className="shrink-0 space-y-4">
          {setupOpen ? (
            <>
              <TaskInput
                value={form}
                onChange={setForm}
                onPreset={handlePreset}
                disabled={anyActive || submitting}
                savedAttachments={active ? (active.task.attachments ?? []) : undefined}
              />

              <AgentSetup
                selected={selected}
                onSelectedChange={setSelected}
                availability={availability}
                isRunning={anyActive || submitting}
                canRun={selected.length > 0 && form.task.trim().length > 0}
                onRun={handleRun}
              />
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
              <span className="shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-foreground/80">
                {form.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {active?.task.title ?? form.task}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {selected.map((id) => providerConfigs[id].vendor).join(" · ") || "No agent"}
              </span>
              <Button size="xs" variant="outline" onClick={() => setSetupOpen(true)}>
                <Pencil className="size-3" />
                Edit
              </Button>
              <Button
                size="xs"
                onClick={handleRun}
                disabled={anyActive || submitting || selected.length === 0 || !form.task.trim()}
              >
                {anyActive || submitting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Play className="size-3" />
                )}
                Run
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>

        {/* The only growing region: everything below stays inside the viewport. */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <section className="flex min-h-[26rem] flex-1 flex-col gap-3">
            <div className="flex shrink-0 items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Execution comparison</h2>
              <span className="text-xs text-muted-foreground">Click any step to inspect the underlying tool call</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
              <AgentColumn
                config={providerConfigs.openai}
                run={runs.openai}
                onSelect={setSelectedEvent}
                onStop={() => handleStop("openai")}
                connectionError={openai.connectionError}
              />
              <AgentColumn
                config={providerConfigs.anthropic}
                run={runs.anthropic}
                onSelect={setSelectedEvent}
                onStop={() => handleStop("anthropic")}
                connectionError={anthropic.connectionError}
              />
            </div>
          </section>

          {failed.length > 0 && !anyActive && (
            <div className="flex shrink-0 items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div>
                <div className="text-sm font-medium text-red-700">
                  {failed.map((id) => providerConfigs[id].vendor).join(" and ")} failed
                </div>
                <div className="text-xs text-red-600/80">Review the execution timeline above for the failing step.</div>
              </div>
            </div>
          )}

          {showComparison && (
            <div className="shrink-0 space-y-6 pb-2">
              <ResultComparison runs={runs} />
              <Evaluation
                scores={active?.evaluations ?? {}}
                onScore={handleScore}
                available={evaluable}
                saved={active?.savedEvaluations ?? {}}
              />
            </div>
          )}
        </div>
      </main>

      <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}
