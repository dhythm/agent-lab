"use client"

import { useState } from "react"
import { FolderGit2, GitBranch, ChevronDown } from "lucide-react"

const DEFAULT_TASK =
  "このリポジトリを調査し、ログイン済みユーザーがトップページにアクセスした場合は /mypage に遷移するよう修正してください。関連するテストを追加し、既存テストもすべて実行してください。"

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">{children}</label>
  )
}

export function TaskInput() {
  const [task, setTask] = useState(DEFAULT_TASK)
  const [repo, setRepo] = useState("dhythm/agent-lab-fixture")

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>Task</FieldLabel>
        <span className="text-xs text-muted-foreground">{task.length} chars</span>
      </div>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        placeholder="Describe the task for both agents..."
      />

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
        <div>
          <FieldLabel>Repository</FieldLabel>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="owner/repo"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Branch</FieldLabel>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <div className="relative flex items-center">
              <select
                defaultValue="main"
                className="cursor-pointer appearance-none bg-transparent pr-5 font-mono text-sm text-foreground outline-none"
              >
                <option value="main">main</option>
                <option value="develop">develop</option>
                <option value="staging">staging</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Task type</FieldLabel>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <div className="relative flex items-center">
              <select
                defaultValue="Coding"
                className="cursor-pointer appearance-none bg-transparent pr-5 text-sm text-foreground outline-none"
              >
                <option>Coding</option>
                <option>Research</option>
                <option>Data Analysis</option>
                <option>General</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
