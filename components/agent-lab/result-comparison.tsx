import { CircleCheckBig } from "lucide-react"
import { ProviderMark } from "./provider-mark"
import { openaiMetrics, claudeMetrics, type ProviderId } from "@/lib/agent-lab-data"

function ResultCard({
  id,
  title,
  metricsTests,
  filesChanged,
}: {
  id: ProviderId
  title: string
  metricsTests: string
  filesChanged: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <ProviderMark id={id} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {metricsTests} tests · {filesChanged} files changed
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <CircleCheckBig className="size-3.5" />
          Passed
        </span>
      </div>
    </div>
  )
}

export function ResultComparison() {
  const rows: { metric: string; openai: string; claude: string; mono?: boolean }[] = [
    { metric: "Result", openai: "Passed", claude: "Passed" },
    { metric: "Duration", openai: openaiMetrics.duration, claude: claudeMetrics.duration },
    { metric: "Steps", openai: String(openaiMetrics.steps), claude: String(claudeMetrics.steps) },
    {
      metric: "Tool calls",
      openai: String(openaiMetrics.toolCalls),
      claude: String(claudeMetrics.toolCalls),
    },
    { metric: "Retries", openai: String(openaiMetrics.retries), claude: String(claudeMetrics.retries) },
    { metric: "Cost", openai: openaiMetrics.cost, claude: claudeMetrics.cost, mono: true },
    {
      metric: "Files changed",
      openai: String(openaiMetrics.filesChanged),
      claude: String(claudeMetrics.filesChanged),
    },
    { metric: "Tests", openai: openaiMetrics.tests, claude: claudeMetrics.tests, mono: true },
  ]

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Result comparison</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ResultCard
          id="openai"
          title="OpenAI Agent API"
          metricsTests={openaiMetrics.tests}
          filesChanged={openaiMetrics.filesChanged}
        />
        <ResultCard
          id="claude"
          title="Claude Managed Agents"
          metricsTests={claudeMetrics.tests}
          filesChanged={claudeMetrics.filesChanged}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Metric</th>
              <th className="px-4 py-2.5 font-medium text-foreground">OpenAI</th>
              <th className="px-4 py-2.5 font-medium text-foreground">Claude</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.metric}
                className={i !== rows.length - 1 ? "border-b border-border" : undefined}
              >
                <td className="px-4 py-2.5 text-muted-foreground">{r.metric}</td>
                <td
                  className={
                    "px-4 py-2.5 text-foreground" + (r.mono ? " font-mono" : "")
                  }
                >
                  {r.openai}
                </td>
                <td
                  className={
                    "px-4 py-2.5 text-foreground" + (r.mono ? " font-mono" : "")
                  }
                >
                  {r.claude}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
