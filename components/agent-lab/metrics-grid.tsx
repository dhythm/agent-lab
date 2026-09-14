import type { AgentMetrics } from "@/lib/agent-lab-data"

export function MetricsGrid({ metrics }: { metrics: AgentMetrics }) {
  const items: { label: string; value: string; mono?: boolean }[] = [
    { label: "Duration", value: metrics.duration },
    { label: "Steps", value: String(metrics.steps) },
    { label: "Tool calls", value: String(metrics.toolCalls) },
    { label: "Files changed", value: String(metrics.filesChanged) },
    { label: "Tests", value: metrics.tests, mono: true },
    { label: "Retries", value: String(metrics.retries) },
    { label: "Est. cost", value: metrics.cost, mono: true },
  ]

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-3 border-t border-border px-3 py-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{it.label}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  )
}
