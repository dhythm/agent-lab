"use client"

import { useEffect, useState } from "react"
import type { AgentRun } from "@/lib/agent-lab/types"
import type { RunMessage } from "@/lib/agent-lab/run-store"

const TERMINAL = new Set(["completed", "failed", "cancelled"])

function applyMessage(current: AgentRun | undefined, message: RunMessage): AgentRun | undefined {
  if (message.kind === "run") {
    // Run snapshots carry the full event list; keep any newer events we already have.
    const known = current?.events ?? []
    const events = message.run.events.length >= known.length ? message.run.events : known
    return { ...message.run, events }
  }
  if (!current) return current
  const index = current.events.findIndex((e) => e.id === message.event.id)
  const events =
    index === -1
      ? [...current.events, message.event]
      : current.events.map((e, i) => (i === index ? message.event : e))
  return { ...current, events }
}

/**
 * Subscribes to a run's Server-Sent Events stream and keeps a local AgentRun
 * up to date. Reconnects while the run is still active.
 */
export function useRunStream(runId: string | undefined, initial?: AgentRun) {
  const [run, setRun] = useState<AgentRun | undefined>(initial)
  const [connectionError, setConnectionError] = useState<string | undefined>()

  useEffect(() => {
    setRun(initial)
  }, [initial])

  useEffect(() => {
    if (!runId) return
    if (initial && TERMINAL.has(initial.status)) return
    const source = new EventSource(`/api/runs/${runId}/events`)
    source.onmessage = (raw) => {
      try {
        const message = JSON.parse(raw.data) as RunMessage
        setRun((current) => applyMessage(current, message))
        setConnectionError(undefined)
        if (message.kind === "run" && TERMINAL.has(message.run.status)) source.close()
      } catch (error) {
        console.error("[use-run-stream] bad message:", error)
      }
    }
    source.onerror = () => {
      // EventSource reconnects on its own; surface the state so the UI can hint at it.
      setConnectionError("Reconnecting…")
    }
    return () => source.close()
  }, [runId, initial])

  return { run, connectionError }
}
