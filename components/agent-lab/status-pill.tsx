import { cn } from "@/lib/utils"
import type { RunStatus } from "@/lib/agent-lab/types"

export type Tone = "ready" | RunStatus

const tones: Record<Tone, { wrap: string; dot: string; label: string }> = {
  ready: {
    wrap: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
    label: "Ready",
  },
  queued: {
    wrap: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400 animate-pulse",
    label: "Queued",
  },
  running: {
    wrap: "bg-blue-50 text-blue-700 border-blue-100",
    dot: "bg-blue-500 animate-pulse",
    label: "Running",
  },
  completed: {
    wrap: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dot: "bg-emerald-500",
    label: "Completed",
  },
  failed: {
    wrap: "bg-red-50 text-red-700 border-red-100",
    dot: "bg-red-500",
    label: "Failed",
  },
  cancelled: {
    wrap: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-500",
    label: "Cancelled",
  },
}

export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: Tone
  label?: string
  className?: string
}) {
  const t = tones[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        t.wrap,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", t.dot)} />
      {label ?? t.label}
    </span>
  )
}
