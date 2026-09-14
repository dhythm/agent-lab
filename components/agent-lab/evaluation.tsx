"use client"

import { Check } from "lucide-react"
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

const SCALE = [1, 2, 3, 4, 5]

function ScoreButtons({
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
  const active = tone === "openai" ? "bg-zinc-900 text-white border-zinc-900" : "bg-[#c2711f] text-white border-[#c2711f]"
  return (
    <div className="flex items-center gap-1" role="radiogroup">
      {SCALE.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={score === n}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cn(
            "size-7 rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            n <= score ? active : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function isComplete(score: EvaluationScore | undefined): boolean {
  return score !== undefined && Object.values(score).every((v) => v > 0)
}

export function Evaluation({
  scores,
  onScore,
  available,
  saved,
}: {
  scores: Partial<Record<ProviderId, EvaluationScore>>
  onScore: (provider: ProviderId, key: EvaluationKey, value: number) => void
  available: ProviderId[]
  saved: Partial<Record<ProviderId, boolean>>
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Evaluation</h2>
        <span className="text-xs text-muted-foreground">1 = poor · 5 = excellent</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 grid grid-cols-[minmax(120px,1fr)_auto_auto] items-center gap-x-8 gap-y-2 border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground">Criteria</span>
          {providerOrder.map((id) => (
            <span key={id} className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ProviderMark id={id} className="size-5 text-xs" />
              {providerConfigs[id].vendor}
              {saved[id] && (
                <span className="inline-flex items-center gap-0.5 text-emerald-600">
                  <Check className="size-3" /> saved
                </span>
              )}
              {!saved[id] && available.includes(id) && isComplete(scores[id]) === false && scores[id] && (
                <span className="text-muted-foreground">unsaved</span>
              )}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {evaluationCriteria.map((row) => (
            <div key={row.key} className="grid grid-cols-[minmax(120px,1fr)_auto_auto] items-center gap-x-8 gap-y-2">
              <span className="text-sm text-foreground">{row.label}</span>
              {providerOrder.map((id) => (
                <ScoreButtons
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
