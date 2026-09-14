import { NextResponse } from "next/server"
import { getService } from "@/lib/agent-lab/service"

export const runtime = "nodejs"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const service = getService()
  const run = await service.store.getRun(id)
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })
  if (run.status !== "running" && run.status !== "queued") {
    return NextResponse.json({ error: `Run is ${run.status}` }, { status: 409 })
  }
  try {
    await service.orchestrator.cancel(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(`[api/runs/${id}/cancel] failed:`, error)
    return NextResponse.json({ error: "Failed to cancel run" }, { status: 500 })
  }
}
