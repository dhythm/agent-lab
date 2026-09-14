"use client"

import { cn } from "@/lib/utils"
import { evaluationCriteria, providerConfigs, providerOrder, type EvaluationKey } from "@/lib/agent-lab-data"
import type { EvaluationScore, ProviderId } from "@/lib/agent-lab/types"
import { ProviderMark } from "./provider-mark"

export const EMPTY_SCORE: EvaluationScore = {
  taskCompletion: 0,
  speed: 0,
  costEfficiency: 0,
  toolEfficiency: 0,
  recovery: 0,
  codeQuality: 0,
}

function Bars({
  score,
  tone,
  onChange,
  disabled,
}: {
  score: number
  tone: ProviderId
  onChange: (score: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={`${i + 1}`}
            onClick={() => onChange(i + 1)}
            className={cn(
              "h-2.5 flex-1 rounded-full transition-colors disabled:cursor-not-allowed",
              i < score ? (tone === "openai" ? "bg-zinc-800" : "bg-[#c2711f]") : "bg-zinc-200 hover:bg-zinc-300",
            )}
          />
        ))}
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {score ? `${score}.0` : "—"}
      </span>
    </div>
  )
}

export function Evaluation({
  scores,
  onScore,
  available,
}: {
  scores: Partial<Record<ProviderId, EvaluationScore>>
  onScore: (provider: ProviderId, key: EvaluationKey, value: number) => void
  available: ProviderId[]
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Evaluation</h2>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 grid grid-cols-[minmax(120px,1fr)_1fr_1fr] items-center gap-4 border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground">Criteria</span>
          {providerOrder.map((id) => (
            <span key={id} className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ProviderMark id={id} className="size-5 text-xs" />
              {providerConfigs[id].vendor}
            </span>
          ))}
        </div>

        <div className="space-y-3">
          {evaluationCriteria.map((row) => (
            <div key={row.key} className="grid grid-cols-[minmax(120px,1fr)_1fr_1fr] items-center gap-4">
              <span className="text-sm text-foreground">{row.label}</span>
              {providerOrder.map((id) => (
                <Bars
                  key={id}
                  score={scores[id]?.[row.key] ?? 0}
                  tone={id}
                  disabled={!available.includes(id)}
                  onChange={(value) => onScore(id, row.key, value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
