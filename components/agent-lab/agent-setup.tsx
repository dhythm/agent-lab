"use client"

import { Play, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ProviderMark } from "./provider-mark"
import { StatusPill } from "./status-pill"
import { providerConfigs, providerOrder, type AgentConfig } from "@/lib/agent-lab-data"
import type { ProviderId } from "@/lib/agent-lab/types"

export interface ProviderAvailability {
  enabled: boolean
  model: string
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-zinc-900" : "bg-zinc-200",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
      {label}
    </button>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}

function AgentCard({
  config,
  availability,
  enabled,
  onToggle,
}: {
  config: AgentConfig
  availability?: ProviderAvailability
  enabled: boolean
  onToggle: (v: boolean) => void
}) {
  const configured = availability?.enabled ?? false
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors",
        enabled && configured ? "border-border" : "border-dashed border-border opacity-70",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <ProviderMark id={config.id} />
          <div className="leading-tight">
            <div className="text-xs text-muted-foreground">{config.vendor}</div>
            <div className="text-sm font-semibold text-foreground">{config.name}</div>
          </div>
        </div>
        <StatusPill
          tone={configured ? "ready" : "failed"}
          label={configured ? "Ready" : "API key missing"}
        />
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <ConfigRow label="Model" value={availability?.model ?? config.model} />
        <ConfigRow label="Environment" value={config.environment} />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-xs text-muted-foreground">Capabilities</div>
        <div className="flex flex-wrap gap-1.5">
          {config.capabilities.map((c) => (
            <span
              key={c}
              className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-foreground/80"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Toggle
          checked={enabled && configured}
          disabled={!configured}
          onChange={onToggle}
          label={`Run ${config.vendor === "OpenAI" ? "OpenAI" : "Claude"}`}
        />
      </div>
    </div>
  )
}

export function AgentSetup({
  selected,
  onSelectedChange,
  availability,
  isRunning,
  canRun,
  onRun,
}: {
  selected: ProviderId[]
  onSelectedChange: (next: ProviderId[]) => void
  availability: Partial<Record<ProviderId, ProviderAvailability>>
  isRunning: boolean
  canRun: boolean
  onRun: () => void
}) {
  function toggle(id: ProviderId, on: boolean) {
    onSelectedChange(on ? [...new Set([...selected, id])] : selected.filter((p) => p !== id))
  }
  const label = selected.length === 2 ? "Run both agents" : selected.length === 1 ? `Run ${providerConfigs[selected[0]].vendor}` : "Select an agent"

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {providerOrder.map((id) => (
          <AgentCard
            key={id}
            config={providerConfigs[id]}
            availability={availability[id]}
            enabled={selected.includes(id)}
            onToggle={(on) => toggle(id, on)}
          />
        ))}
      </div>

      <Button size="lg" onClick={onRun} disabled={!canRun || isRunning} className="h-11 w-full text-sm">
        {isRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Running agents...
          </>
        ) : (
          <>
            <Play className="size-4" />
            {label}
          </>
        )}
      </Button>
    </section>
  )
}
