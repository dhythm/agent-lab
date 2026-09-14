import { cn } from "@/lib/utils"
import { evaluation } from "@/lib/agent-lab-data"
import { ProviderMark } from "./provider-mark"

function Bars({ score, tone }: { score: number; tone: "openai" | "claude" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < score
                ? tone === "openai"
                  ? "bg-zinc-800"
                  : "bg-[#c2711f]"
                : "bg-zinc-200",
            )}
          />
        ))}
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {score}.0
      </span>
    </div>
  )
}

export function Evaluation() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Evaluation</h2>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 grid grid-cols-[minmax(120px,1fr)_1fr_1fr] items-center gap-4 border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground">Criteria</span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ProviderMark id="openai" className="size-5 text-xs" />
            OpenAI
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ProviderMark id="claude" className="size-5 text-xs" />
            Claude
          </span>
        </div>

        <div className="space-y-3">
          {evaluation.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(120px,1fr)_1fr_1fr] items-center gap-4"
            >
              <span className="text-sm text-foreground">{row.label}</span>
              <Bars score={row.openai} tone="openai" />
              <Bars score={row.claude} tone="claude" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
