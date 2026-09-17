import type { AgentProvider, ProviderRunHandle, ProviderRunSink } from "./provider"
import type { RunStore } from "./run-store"
import type { AgentRun, AgentTask, ProviderId } from "./types"
import { validateSeoOutput } from "./seo-output"

export interface Orchestrator {
  start(task: AgentTask, providers: ProviderId[]): Promise<AgentRun[]>
  cancel(runId: string): Promise<void>
}

export interface OrchestratorOptions {
  store: RunStore
  providers: AgentProvider[]
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function createOrchestrator(options: OrchestratorOptions): Orchestrator {
  const { store } = options
  const providers = new Map(options.providers.map((p) => [p.id, p]))
  const starting = new Map<string, Promise<ProviderRunHandle>>()
  const cancelRequested = new Set<string>()

  function makeSink(runId: string): ProviderRunSink {
    return {
      emit(event) {
        return store.appendEvent(runId, event)
      },
      updateEvent(eventId, patch) {
        return store.updateEvent(runId, eventId, patch)
      },
      async setExternalId(externalId) {
        await store.updateRun(runId, { externalId })
      },
    }
  }

  async function fail(runId: string, error: unknown): Promise<void> {
    const message = errorMessage(error)
    const status = cancelRequested.has(runId) ? "cancelled" : "failed"
    await store.appendEvent(runId, {
      type: status === "cancelled" ? "warning" : "error",
      title: status === "cancelled" ? "Run cancelled" : "Run failed",
      detail: message,
      timestamp: new Date().toISOString(),
    })
    await store.updateRun(runId, {
      status,
      error: status === "failed" ? message : undefined,
      completedAt: new Date().toISOString(),
    })
  }

  async function execute(run: AgentRun, task: AgentTask): Promise<void> {
    const provider = providers.get(run.provider)
    if (!provider) {
      await fail(run.id, new Error(`Provider "${run.provider}" is not configured`))
      return
    }
    try {
      const handlePromise = provider.startRun(
        { runId: run.id, task },
        makeSink(run.id),
      )
      // Both promises are awaited below; pre-attach handlers so a rejection that
      // lands while we persist the "running" status is never reported as unhandled.
      handlePromise.then((h) => h.done.catch(() => {})).catch(() => {})
      starting.set(run.id, handlePromise)
      await store.updateRun(run.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      })
      const handle = await handlePromise
      const outcome = await handle.done
      if (task.type === "seo-proofread") {
        const validation = validateSeoOutput(task.prompt, outcome.result.finalOutput)
        if (!validation.ok) {
          await store.appendEvent(run.id, {
            type: "error",
            title: "Invalid SEO output",
            detail: validation.error,
            timestamp: new Date().toISOString(),
          })
          await store.updateRun(run.id, {
            status: "failed",
            error: validation.error,
            result: {
              ...outcome.result,
              outputValidation: { valid: false, error: validation.error },
            },
            completedAt: new Date().toISOString(),
          })
          return
        }
        outcome.result = {
          ...outcome.result,
          finalOutput: validation.output,
          outputValidation: { valid: true },
        }
      }
      await store.appendEvent(run.id, {
        type: "final_output",
        title: "Final output",
        detail: outcome.result.finalOutput,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(outcome.costUsd === undefined ? {} : { costUsd: outcome.costUsd }),
          ...(outcome.usage ? { usage: outcome.usage } : {}),
        },
      })
      await store.updateRun(run.id, {
        status: cancelRequested.has(run.id) ? "cancelled" : "completed",
        result: outcome.result,
        completedAt: new Date().toISOString(),
      })
    } catch (error) {
      await fail(run.id, error)
    } finally {
      starting.delete(run.id)
      cancelRequested.delete(run.id)
    }
  }

  return {
    async start(task, providerIds) {
      const { runs } = await store.createTaskRuns(task, providerIds)
      for (const run of runs) {
        void execute(run, task).catch((error) => {
          console.error(`[orchestrator] run ${run.id} crashed:`, error)
        })
      }
      return runs
    },

    async cancel(runId) {
      const handlePromise = starting.get(runId)
      if (!handlePromise) {
        const run = await store.getRun(runId)
        if (run && (run.status === "queued" || run.status === "running")) {
          cancelRequested.add(runId)
          await fail(runId, new Error("Cancelled before the provider started"))
        }
        return
      }
      cancelRequested.add(runId)
      let handle: ProviderRunHandle
      try {
        handle = await handlePromise
      } catch {
        return // startRun failed; execute() already recorded the failure
      }
      await handle.cancel()
    },
  }
}
