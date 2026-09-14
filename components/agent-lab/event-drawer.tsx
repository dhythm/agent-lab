"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AgentEvent } from "@/lib/agent-lab/types"
import { formatDuration } from "@/lib/agent-lab/format"
import { eventVisuals } from "./event-visuals"

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium text-muted-foreground">{children}</div>
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Mono({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <pre
      className={cn(
        "max-h-96 overflow-auto rounded-lg border border-border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words",
        dark ? "bg-zinc-950 text-zinc-100" : "bg-muted/50 text-foreground",
      )}
    >
      {children}
    </pre>
  )
}

type DiffLine = { type: "add" | "del"; text: string }

function editDiff(oldString: unknown, newString: unknown): DiffLine[] | undefined {
  if (typeof oldString !== "string" && typeof newString !== "string") return undefined
  const lines: DiffLine[] = []
  if (typeof oldString === "string") for (const t of oldString.split("\n")) lines.push({ type: "del", text: t })
  if (typeof newString === "string") for (const t of newString.split("\n")) lines.push({ type: "add", text: t })
  return lines
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function EventDrawer({ event, onClose }: { event: AgentEvent | null; onClose: () => void }) {
  if (!event) return null
  const visual = eventVisuals[event.type]
  const Icon = visual.icon
  const meta = event.metadata ?? {}
  const command = asString(meta.command)
  const filePath = asString(meta.path)
  const diff = editDiff(meta.oldString, meta.newString)
  const content = asString(meta.content)
  const input = meta.input
  const showInput =
    input !== undefined && !command && !filePath && event.type !== "planning" && event.type !== "thinking"
  const output = event.detail
  const outputLabel =
    event.type === "planning" || event.type === "final_output" || event.type === "thinking"
      ? "Message"
      : event.type === "error" || event.type === "warning" || event.type === "retry"
        ? "Details"
        : "Output"

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-zinc-900/20 animate-in fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md border", visual.chip)}>
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-xs text-muted-foreground">{visual.label}</div>
            <div className="truncate text-sm font-semibold text-foreground">{event.title}</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
            {event.durationMs !== undefined && <span>{formatDuration(event.durationMs)}</span>}
            {asString(meta.tool) && <span className="font-mono">{asString(meta.tool)}</span>}
            {typeof meta.exitCode === "number" && <span className="font-mono">exit {meta.exitCode}</span>}
          </div>

          {command && (
            <Block label="Command">
              <Mono>{command}</Mono>
            </Block>
          )}

          {filePath && (
            <Block label="File">
              <Mono>{filePath}</Mono>
            </Block>
          )}

          {diff && (
            <Block label="Diff">
              <div className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/30 py-1 font-mono text-xs">
                {diff.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 px-3 py-0.5 whitespace-pre-wrap",
                      line.type === "add" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
                    )}
                  >
                    <span className="select-none opacity-60">{line.type === "add" ? "+" : "-"}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {content && (
            <Block label="Content">
              <Mono>{content}</Mono>
            </Block>
          )}

          {showInput && (
            <Block label="Input">
              <Mono>{JSON.stringify(input, null, 2)}</Mono>
            </Block>
          )}

          {output && (
            <Block label={outputLabel}>
              {outputLabel === "Output" ? (
                <Mono dark>{output}</Mono>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{output}</p>
              )}
            </Block>
          )}
        </div>
      </aside>
    </div>
  )
}
