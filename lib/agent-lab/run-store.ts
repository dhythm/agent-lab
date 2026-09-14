import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { computeMetrics } from "./metrics"
import type {
  AgentEvent,
  AgentRun,
  AgentTask,
  EvaluationScore,
  NewAgentEvent,
  ProviderId,
} from "./types"

export interface TaskRecord {
  task: AgentTask
  runs: AgentRun[]
  evaluations: Record<string, EvaluationScore>
}

export type RunMessage =
  | { kind: "event"; event: AgentEvent }
  | { kind: "run"; run: AgentRun }

export type RunListener = (message: RunMessage) => void

export interface RunStore {
  createTaskRuns(
    task: AgentTask,
    providers: ProviderId[],
  ): Promise<{ task: AgentTask; runs: AgentRun[] }>
  getRun(runId: string): Promise<AgentRun | undefined>
  getTask(taskId: string): Promise<TaskRecord | undefined>
  listTasks(): Promise<TaskRecord[]>
  appendEvent(runId: string, event: NewAgentEvent): Promise<AgentEvent>
  updateEvent(
    runId: string,
    eventId: string,
    patch: Partial<Omit<AgentEvent, "id" | "runId" | "provider">>,
  ): Promise<AgentEvent>
  updateRun(
    runId: string,
    patch: Partial<Omit<AgentRun, "id" | "taskId" | "provider" | "events">>,
  ): Promise<AgentRun>
  saveEvaluation(runId: string, score: EvaluationScore): Promise<void>
  subscribe(runId: string, listener: RunListener): () => void
}

export interface RunStoreOptions {
  dir: string
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

export function createRunStore(options: RunStoreOptions): RunStore {
  const records = new Map<string, TaskRecord>()
  const runIndex = new Map<string, string>()
  const listeners = new Map<string, Set<RunListener>>()
  let loaded: Promise<void> | undefined
  let writeChain: Promise<void> = Promise.resolve()

  function filePath(taskId: string): string {
    return path.join(options.dir, `${taskId}.json`)
  }

  async function load(): Promise<void> {
    await mkdir(options.dir, { recursive: true })
    const names = await readdir(options.dir)
    for (const name of names) {
      if (!name.endsWith(".json")) continue
      try {
        const raw = await readFile(path.join(options.dir, name), "utf8")
        const record = JSON.parse(raw) as TaskRecord
        index(record)
      } catch (error) {
        console.warn(`[run-store] skipping unreadable record ${name}:`, error)
      }
    }
  }

  function index(record: TaskRecord): void {
    records.set(record.task.id, record)
    for (const run of record.runs) runIndex.set(run.id, record.task.id)
  }

  function ensureLoaded(): Promise<void> {
    if (!loaded) loaded = load()
    return loaded
  }

  function persist(record: TaskRecord): Promise<void> {
    const snapshot = JSON.stringify(record, null, 2)
    writeChain = writeChain
      .then(() => writeFile(filePath(record.task.id), snapshot, "utf8"))
      .catch((error) => {
        console.error(`[run-store] failed to persist ${record.task.id}:`, error)
      })
    return writeChain
  }

  function emit(runId: string, message: RunMessage): void {
    const set = listeners.get(runId)
    if (!set) return
    for (const listener of set) {
      try {
        listener(message)
      } catch (error) {
        console.error("[run-store] listener failed:", error)
      }
    }
  }

  async function findRun(runId: string): Promise<{ record: TaskRecord; run: AgentRun }> {
    await ensureLoaded()
    const taskId = runIndex.get(runId)
    const record = taskId ? records.get(taskId) : undefined
    const run = record?.runs.find((r) => r.id === runId)
    if (!record || !run) throw new Error(`Run not found: ${runId}`)
    return { record, run }
  }

  return {
    async createTaskRuns(task, providers) {
      await ensureLoaded()
      const runs: AgentRun[] = providers.map((provider) => ({
        id: newId("run"),
        taskId: task.id,
        provider,
        status: "queued",
        events: [],
      }))
      const record: TaskRecord = { task, runs, evaluations: {} }
      index(record)
      await persist(record)
      return { task, runs }
    },

    async getRun(runId) {
      await ensureLoaded()
      const taskId = runIndex.get(runId)
      return taskId ? records.get(taskId)?.runs.find((r) => r.id === runId) : undefined
    },

    async getTask(taskId) {
      await ensureLoaded()
      return records.get(taskId)
    },

    async listTasks() {
      await ensureLoaded()
      return [...records.values()].sort((a, b) =>
        b.task.createdAt.localeCompare(a.task.createdAt),
      )
    },

    async appendEvent(runId, input) {
      const { record, run } = await findRun(runId)
      const event: AgentEvent = {
        ...input,
        id: newId("evt"),
        runId,
        provider: run.provider,
      }
      run.events.push(event)
      run.metrics = computeMetrics(run)
      emit(runId, { kind: "event", event })
      await persist(record)
      return event
    },

    async updateEvent(runId, eventId, patch) {
      const { record, run } = await findRun(runId)
      const event = run.events.find((e) => e.id === eventId)
      if (!event) throw new Error(`Event not found: ${eventId}`)
      Object.assign(event, patch)
      run.metrics = computeMetrics(run)
      emit(runId, { kind: "event", event })
      await persist(record)
      return event
    },

    async updateRun(runId, patch) {
      const { record, run } = await findRun(runId)
      Object.assign(run, patch)
      run.metrics = computeMetrics(run)
      emit(runId, { kind: "run", run })
      await persist(record)
      return run
    },

    async saveEvaluation(runId, score) {
      const { record } = await findRun(runId)
      record.evaluations[runId] = score
      await persist(record)
    },

    subscribe(runId, listener) {
      let set = listeners.get(runId)
      if (!set) {
        set = new Set()
        listeners.set(runId, set)
      }
      set.add(listener)
      return () => {
        set?.delete(listener)
        if (set && set.size === 0) listeners.delete(runId)
      }
    },
  }
}
