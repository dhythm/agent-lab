import type { ProviderRunSink } from "@/lib/agent-lab/provider"
import type { NormalizedAction } from "./normalized-action"

/**
 * Applies normalized actions to a run sink, remembering which stored event
 * each provider key maps to so later updates land on the right row.
 */
export function createActionApplier(sink: ProviderRunSink) {
  const eventIds = new Map<string, string>()
  const metadata = new Map<string, Record<string, unknown>>()

  return async function apply(actions: NormalizedAction[]): Promise<void> {
    for (const action of actions) {
      if (action.kind === "append") {
        const stored = await sink.emit(action.event)
        eventIds.set(action.key, stored.id)
        if (action.event.metadata) metadata.set(action.key, action.event.metadata)
        continue
      }
      const eventId = eventIds.get(action.key)
      if (!eventId) continue
      const patch = { ...action.patch }
      if (patch.metadata) {
        const merged = { ...(metadata.get(action.key) ?? {}), ...patch.metadata }
        metadata.set(action.key, merged)
        patch.metadata = merged
      }
      await sink.updateEvent(eventId, patch)
    }
  }
}
