import { NextResponse } from "next/server"
import { z } from "zod"
import { getService } from "@/lib/agent-lab/service"
import { newId } from "@/lib/agent-lab/run-store"
import { toPublicTask } from "@/lib/agent-lab/public"
import type { AgentTask, StoredFile } from "@/lib/agent-lab/types"

export const runtime = "nodejs"

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const MAX_ATTACHMENTS = 10

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

interface ParsedBody {
  fields: unknown
  files: File[]
}

async function parseBody(request: Request): Promise<ParsedBody> {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const files = form.getAll("files").filter((v): v is File => v instanceof File && v.size > 0)
    return {
      fields: {
        task: form.get("task"),
        repository: form.get("repository") ?? undefined,
        branch: form.get("branch") ?? undefined,
        type: form.get("type") ?? undefined,
        providers: form.getAll("providers"),
      },
      files,
    }
  }
  return { fields: await request.json(), files: [] }
}

export async function POST(request: Request) {
  let body: ParsedBody
  try {
    body = await parseBody(request)
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body.fields)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 })
  }
  if (body.files.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `At most ${MAX_ATTACHMENTS} attachments` }, { status: 400 })
  }
  const oversized = body.files.find((f) => f.size > MAX_ATTACHMENT_BYTES)
  if (oversized) {
    return NextResponse.json({ error: `${oversized.name} exceeds 10 MB` }, { status: 413 })
  }

  const service = getService()
  const input = parsed.data
  const taskId = newId("task")
  const attachments: StoredFile[] = []
  try {
    for (const file of body.files) {
      attachments.push(
        await service.files.saveAttachment(taskId, file.name, Buffer.from(await file.arrayBuffer())),
      )
    }
  } catch (error) {
    console.error("[api/runs] failed to store attachments:", error)
    return NextResponse.json({ error: "Failed to store attachments" }, { status: 500 })
  }

  const task: AgentTask = {
    id: taskId,
    title: titleFrom(input.task),
    prompt: input.task,
    type: input.type,
    repository: input.repository || undefined,
    branch: input.branch || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    createdAt: new Date().toISOString(),
  }
  try {
    const runs = await service.orchestrator.start(task, [...new Set(input.providers)])
    return NextResponse.json(
      { task: toPublicTask(task), runs: runs.map((run) => ({ id: run.id, provider: run.provider })) },
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
      task: toPublicTask(record.task),
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
