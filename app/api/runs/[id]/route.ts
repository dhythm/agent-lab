import { NextResponse } from "next/server"
import { getService } from "@/lib/agent-lab/service"
import { toPublicRun } from "@/lib/agent-lab/public"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const run = await getService().store.getRun(id)
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })
  return NextResponse.json({ run: toPublicRun(run) })
}
