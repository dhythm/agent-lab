import { getService } from "@/lib/agent-lab/service"
import type { RunMessage } from "@/lib/agent-lab/run-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TERMINAL = new Set(["completed", "failed", "cancelled"])

/**
 * Server-Sent Events: replays the run's current state, then pushes live
 * `event` and `run` messages until the run reaches a terminal status.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { store } = getService()
  const run = await store.getRun(id)
  if (!run) return new Response("Run not found", { status: 404 })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: RunMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`))
        } catch {
          // Stream already closed by the client.
        }
      }
      const close = () => {
        unsubscribe?.()
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // Already closed.
        }
      }

      send({ kind: "run", run })
      if (TERMINAL.has(run.status)) {
        close()
        return
      }
      unsubscribe = store.subscribe(id, (message) => {
        send(message)
        if (message.kind === "run" && TERMINAL.has(message.run.status)) close()
      })
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"))
        } catch {
          close()
        }
      }, 15_000)
    },
    cancel() {
      unsubscribe?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
