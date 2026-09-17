"use client"

import { useRef } from "react"
import { FolderGit2, GitBranch, ChevronDown, Paperclip, X, LayoutTemplate } from "lucide-react"
import { taskPresets } from "@/lib/agent-lab/presets"
import type { TaskType } from "@/lib/agent-lab/types"

export interface TaskFormValue {
  task: string
  repository: string
  branch: string
  type: TaskType
  files: File[]
  presetId?: string
}

export const DEFAULT_TASK_FORM: TaskFormValue = {
  task: taskPresets.find((preset) => preset.id === "coding-redirect")!.prompt,
  repository: "",
  branch: "main",
  type: "coding",
  files: [],
  presetId: "coding-redirect",
}

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "coding", label: "Coding" },
  { value: "research", label: "Research" },
  { value: "data", label: "Data Analysis" },
  { value: "general", label: "General" },
  { value: "article", label: "Article (structured output)" },
  { value: "seo-proofread", label: "SEO article proofreading" },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export interface AttachmentSummary {
  name: string
  size: number
}

export function TaskInput({
  value,
  onChange,
  onPreset,
  disabled,
  savedAttachments,
}: {
  value: TaskFormValue
  onChange: (next: TaskFormValue) => void
  onPreset: (presetId: string) => void
  disabled?: boolean
  /** Attachments of a task loaded from history (read-only). */
  savedAttachments?: AttachmentSummary[]
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof TaskFormValue>(key: K, v: TaskFormValue[K]) => onChange({ ...value, [key]: v })

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const names = new Set(incoming.map((f) => f.name))
    set("files", [...value.files.filter((f) => !names.has(f.name)), ...incoming])
    if (fileInput.current) fileInput.current.value = ""
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <FieldLabel>{value.type === "seo-proofread" ? "User input" : "Task"}</FieldLabel>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center rounded-lg border border-border bg-background px-2 py-1">
            <LayoutTemplate className="mr-1.5 size-3.5 text-muted-foreground" />
            <select
              value={value.presetId ?? ""}
              onChange={(e) => e.target.value && onPreset(e.target.value)}
              disabled={disabled}
              className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none"
            >
              <option value="">Custom task</option>
              {taskPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground">{value.task.length} chars</span>
        </div>
      </div>
      <textarea
        value={value.task}
        onChange={(e) => onChange({ ...value, task: e.target.value, presetId: undefined })}
        disabled={disabled}
        rows={value.type === "seo-proofread" ? 10 : 4}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60"
        placeholder="Describe the task for both agents..."
      />

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
        <div>
          <FieldLabel>Repository</FieldLabel>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={value.repository}
              onChange={(e) => set("repository", e.target.value)}
              disabled={disabled}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="owner/repo or https://github.com/owner/repo (optional)"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Branch</FieldLabel>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={value.branch}
              onChange={(e) => set("branch", e.target.value)}
              disabled={disabled}
              className="w-28 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="main"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Task type</FieldLabel>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <div className="relative flex items-center">
              <select
                value={value.type}
                onChange={(e) => set("type", e.target.value as TaskType)}
                disabled={disabled}
                className="cursor-pointer appearance-none bg-transparent pr-5 text-sm text-foreground outline-none"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Attachments</FieldLabel>
          {!savedAttachments && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline disabled:opacity-50"
            >
              <Paperclip className="size-3.5" />
              Add files
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {(savedAttachments ?? value.files).map((file) => (
            <li
              key={file.name}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-foreground/80"
            >
              {file.name}
              <span className="text-muted-foreground">{formatSize(file.size)}</span>
              {!savedAttachments && !disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => set("files", value.files.filter((f) => f !== file))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
          {(savedAttachments ?? value.files).length === 0 && (
            <li className="text-xs text-muted-foreground">None</li>
          )}
        </ul>
      </div>
    </section>
  )
}
