import { NextResponse } from "next/server"
import { z } from "zod"
import { getService } from "@/lib/agent-lab/service"

export const runtime = "nodejs"

const score = z.number().int().min(1).max(5)
const schema = z.object({
  taskCompletion: score,
  speed: score,
  costEfficiency: score,
  toolEfficiency: score,
  recovery: score,
  codeQuality: score,
})

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation", issues: parsed.error.issues }, { status: 400 })
  }
  try {
    await getService().store.saveEvaluation(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save evaluation"
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 })
  }
}
