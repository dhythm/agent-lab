"use client"

import { useState } from "react"
import { Play, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ProviderMark } from "./provider-mark"
import { StatusPill } from "./status-pill"
import { openaiConfig, claudeConfig, type AgentConfig, type RunStatus } from "@/lib/agent-lab-data"

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-medium text-foreground"
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
  enabled,
  onToggle,
}: {
  config: AgentConfig
  enabled: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors",
        enabled ? "border-border" : "border-dashed border-border opacity-70",
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
        <StatusPill tone="ready" />
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <ConfigRow label="Model" value={config.model} />
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
          checked={enabled}
          onChange={onToggle}
          label={`Run ${config.vendor === "OpenAI" ? "OpenAI" : "Claude"}`}
        />
      </div>
    </div>
  )
}

export function AgentSetup({
  status,
  onRun,
}: {
  status: RunStatus
  onRun: () => void
}) {
  const [runOpenAI, setRunOpenAI] = useState(true)
  const [runClaude, setRunClaude] = useState(true)
  const isRunning = status === "running"
  const canRun = runOpenAI || runClaude

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AgentCard config={openaiConfig} enabled={runOpenAI} onToggle={setRunOpenAI} />
        <AgentCard config={claudeConfig} enabled={runClaude} onToggle={setRunClaude} />
      </div>

      <Button
        size="lg"
        onClick={onRun}
        disabled={!canRun || isRunning}
        className="h-11 w-full text-sm"
      >
        {isRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Running agents...
          </>
        ) : (
          <>
            <Play className="size-4" />
            Run both agents
          </>
        )}
      </Button>
    </section>
  )
}
