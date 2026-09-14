import { NextResponse } from "next/server"
import { getService } from "@/lib/agent-lab/service"
import { toPublicTaskRecord } from "@/lib/agent-lab/public"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const record = await getService().store.getTask(id)
  if (!record) return NextResponse.json({ error: "Task not found" }, { status: 404 })
  return NextResponse.json(toPublicTaskRecord(record))
}
