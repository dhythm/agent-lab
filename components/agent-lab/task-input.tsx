"use client"

import { FolderGit2, GitBranch, ChevronDown } from "lucide-react"
import type { TaskType } from "@/lib/agent-lab/types"

export interface TaskFormValue {
  task: string
  repository: string
  branch: string
  type: TaskType
}

export const DEFAULT_TASK_FORM: TaskFormValue = {
  task: "このリポジトリを調査し、ログイン済みユーザーがトップページにアクセスした場合は /mypage に遷移するよう修正してください。関連するテストを追加し、既存テストもすべて実行してください。",
  repository: "",
  branch: "main",
  type: "coding",
}

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "coding", label: "Coding" },
  { value: "research", label: "Research" },
  { value: "data", label: "Data Analysis" },
  { value: "general", label: "General" },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>
}

export function TaskInput({
  value,
  onChange,
  disabled,
}: {
  value: TaskFormValue
  onChange: (next: TaskFormValue) => void
  disabled?: boolean
}) {
  const set = <K extends keyof TaskFormValue>(key: K, v: TaskFormValue[K]) => onChange({ ...value, [key]: v })

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>Task</FieldLabel>
        <span className="text-xs text-muted-foreground">{value.task.length} chars</span>
      </div>
      <textarea
        value={value.task}
        onChange={(e) => set("task", e.target.value)}
        disabled={disabled}
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60"
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
              placeholder="owner/repo or https://github.com/owner/repo"
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
    </section>
  )
}
