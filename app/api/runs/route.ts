import { NextResponse } from "next/server"
import { z } from "zod"
import { getService } from "@/lib/agent-lab/service"
import { newId } from "@/lib/agent-lab/run-store"
import type { AgentTask } from "@/lib/agent-lab/types"

export const runtime = "nodejs"

const createSchema = z.object({
  task: z.string().trim().min(1).max(20_000),
  repository: z.string().trim().max(500).optional(),
  branch: z.string().trim().max(200).optional(),
  type: z.enum(["coding", "research", "data", "general"]).default("coding"),
  providers: z.array(z.enum(["openai", "anthropic"])).min(1),
})

function titleFrom(prompt: string): string {
  const firstLine = prompt.split("\n").find((line) => line.trim()) ?? prompt
  return firstLine.trim().slice(0, 80)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 })
  }
  const input = parsed.data
  const task: AgentTask = {
    id: newId("task"),
    title: titleFrom(input.task),
    prompt: input.task,
    type: input.type,
    repository: input.repository || undefined,
    branch: input.branch || undefined,
    createdAt: new Date().toISOString(),
  }
  try {
    const runs = await getService().orchestrator.start(task, [...new Set(input.providers)])
    return NextResponse.json(
      { task, runs: runs.map((run) => ({ id: run.id, provider: run.provider })) },
      { status: 201 },
    )
  } catch (error) {
    console.error("[api/runs] failed to start:", error)
    return NextResponse.json({ error: "Failed to start runs" }, { status: 500 })
  }
}

export async function GET() {
  const tasks = await getService().store.listTasks()
  return NextResponse.json({
    tasks: tasks.map((record) => ({
      task: record.task,
      runs: record.runs.map((run) => ({
        id: run.id,
        provider: run.provider,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        metrics: run.metrics,
      })),
    })),
  })
}
