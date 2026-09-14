import type { AgentMetrics } from "@/lib/agent-lab/types"
import { formatCost, formatCount, formatDuration, formatTokens } from "@/lib/agent-lab/format"

export function MetricsGrid({ metrics, testResult }: { metrics?: AgentMetrics; testResult?: string }) {
  const items: { label: string; value: string; mono?: boolean }[] = [
    { label: "Duration", value: formatDuration(metrics?.durationMs) },
    { label: "Steps", value: formatCount(metrics?.steps) },
    { label: "Tool calls", value: formatCount(metrics?.toolCalls) },
    { label: "Files changed", value: formatCount(metrics?.filesChanged) },
    { label: "Tests", value: testResult ? testResult.split(":")[0] : "—", mono: true },
    { label: "Retries", value: formatCount(metrics?.retries) },
    { label: "Tokens in / out", value: `${formatTokens(metrics?.inputTokens)} / ${formatTokens(metrics?.outputTokens)}`, mono: true },
    { label: "Est. cost", value: formatCost(metrics?.estimatedCost), mono: true },
  ]

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-3 border-t border-border px-3 py-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{it.label}</div>
          <div className={"mt-0.5 truncate text-sm font-semibold text-foreground" + (it.mono ? " font-mono" : "")}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  )
}
