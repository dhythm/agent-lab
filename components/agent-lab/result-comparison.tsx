"use client"

import { useState } from "react"
import { CircleCheckBig, CircleX, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProviderMark } from "./provider-mark"
import { providerConfigs, providerOrder } from "@/lib/agent-lab-data"
import type { AgentRun, ProviderId } from "@/lib/agent-lab/types"
import { formatCost, formatCount, formatDuration, formatTokens } from "@/lib/agent-lab/format"

function ResultCard({ id, run }: { id: ProviderId; run?: AgentRun }) {
  const [open, setOpen] = useState(false)
  const config = providerConfigs[id]
  const ok = run?.status === "completed"
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <ProviderMark id={id} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-foreground">
            {config.vendor} {config.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {run?.result?.testResult ?? "No tests observed"} · {run?.result?.changedFiles.length ?? 0} files changed
          </div>
        </div>
        {run && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
              ok
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-red-100 bg-red-50 text-red-700",
            )}
          >
            {ok ? <CircleCheckBig className="size-3.5" /> : <CircleX className="size-3.5" />}
            {ok ? "Completed" : run.status}
          </span>
        )}
      </div>

      {run?.result && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-sm leading-relaxed text-foreground">{run.result.summary}</p>
          {run.result.changedFiles.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {run.result.changedFiles.map((file) => (
                <li key={file} className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                  {file}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Final output
          </button>
          {open && (
            <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {run.result.finalOutput || "(empty)"}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function ResultComparison({ runs }: { runs: Partial<Record<ProviderId, AgentRun>> }) {
  const cell = (id: ProviderId, f: (run: AgentRun) => string) => (runs[id] ? f(runs[id]) : "—")
  const rows: { metric: string; f: (run: AgentRun) => string; mono?: boolean }[] = [
    { metric: "Result", f: (r) => r.status },
    { metric: "Duration", f: (r) => formatDuration(r.metrics?.durationMs) },
    { metric: "Steps", f: (r) => formatCount(r.metrics?.steps) },
    { metric: "Tool calls", f: (r) => formatCount(r.metrics?.toolCalls) },
    { metric: "Retries", f: (r) => formatCount(r.metrics?.retries) },
    { metric: "Tokens in / out", f: (r) => `${formatTokens(r.metrics?.inputTokens)} / ${formatTokens(r.metrics?.outputTokens)}`, mono: true },
    { metric: "Cost", f: (r) => formatCost(r.metrics?.estimatedCost), mono: true },
    { metric: "Files changed", f: (r) => formatCount(r.metrics?.filesChanged) },
    { metric: "Tests", f: (r) => r.result?.testResult?.split(":")[0] ?? "—", mono: true },
  ]

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Result comparison</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {providerOrder.map((id) => (
          <ResultCard key={id} id={id} run={runs[id]} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Metric</th>
              {providerOrder.map((id) => (
                <th key={id} className="px-4 py-2.5 font-medium text-foreground">
                  {providerConfigs[id].vendor}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.metric} className={i !== rows.length - 1 ? "border-b border-border" : undefined}>
                <td className="px-4 py-2.5 text-muted-foreground">{r.metric}</td>
                {providerOrder.map((id) => (
                  <td key={id} className={"px-4 py-2.5 text-foreground" + (r.mono ? " font-mono" : "")}>
                    {cell(id, r.f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
