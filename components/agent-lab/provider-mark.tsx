import { cn } from "@/lib/utils"
import type { ProviderId } from "@/lib/agent-lab-data"

const marks: Record<ProviderId, { className: string; glyph: string }> = {
  openai: {
    className: "bg-zinc-900 text-white border-zinc-900",
    glyph: "O",
  },
  claude: {
    className: "bg-[#f6efe6] text-[#b0530f] border-[#eaddcb]",
    glyph: "C",
  },
}

export function ProviderMark({
  id,
  className,
}: {
  id: ProviderId
  className?: string
}) {
  const m = marks[id]
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold",
        m.className,
        className,
      )}
      aria-hidden
    >
      {m.glyph}
    </span>
  )
}
