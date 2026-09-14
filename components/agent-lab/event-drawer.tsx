"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { TimelineEvent } from "@/lib/agent-lab-data"
import { eventVisuals } from "./event-visuals"

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-medium text-muted-foreground">{children}</div>
  )
}

export function EventDrawer({
  event,
  onClose,
}: {
  event: TimelineEvent | null
  onClose: () => void
}) {
  if (!event) return null
  const d = event.drawer
  const visual = eventVisuals[event.type]
  const Icon = visual.icon

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-zinc-900/20 animate-in fade-in"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <span
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md border",
              visual.chip,
            )}
          >
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-xs text-muted-foreground">{d.category}</div>
            <div className="truncate text-sm font-semibold text-foreground">
              {event.title}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {d.subtype && (
            <div>
              <Label>Type</Label>
              <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
                {d.subtype}
              </span>
            </div>
          )}

          {d.command && (
            <div>
              <Label>Command</Label>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                {d.command}
              </pre>
            </div>
          )}

          {d.filename && (
            <div>
              <Label>File</Label>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                {d.filename}
              </pre>
            </div>
          )}

          {d.diff && (
            <div>
              <Label>Diff</Label>
              <div className="overflow-x-auto rounded-lg border border-border bg-muted/30 py-1 font-mono text-xs">
                {d.diff.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 px-3 py-0.5 whitespace-pre",
                      line.type === "add" && "bg-emerald-50 text-emerald-800",
                      line.type === "del" && "bg-red-50 text-red-700",
                      line.type === "ctx" && "text-muted-foreground",
                    )}
                  >
                    <span className="select-none opacity-60">
                      {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                    </span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.output && (
            <div>
              <Label>Output</Label>
              <pre className="overflow-x-auto rounded-lg border border-border bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100">
                {d.output}
              </pre>
            </div>
          )}

          {d.duration && (
            <div>
              <Label>Duration</Label>
              <span className="font-mono text-sm text-foreground">{d.duration}</span>
            </div>
          )}

          {d.note && (
            <div>
              <Label>Details</Label>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {d.note}
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
