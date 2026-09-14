import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { StoredFile } from "./types"

function cleanSegment(segment: string): string {
  return segment
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
}

export function safeFileName(input: string): string {
  const base = input.split(/[\\/]/).filter(Boolean).at(-1) ?? ""
  const ext = path.extname(base)
  const stem = ext ? base.slice(0, -ext.length) : base
  const cleanExt = ext.replace(/[^\p{L}\p{N}.]/gu, "")
  return (cleanSegment(stem) || "file") + (cleanExt.length > 1 ? cleanExt : "")
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function uniqueName(dir: string, name: string): Promise<string> {
  if (!(await exists(path.join(dir, name)))) return name
  const ext = path.extname(name)
  const stem = name.slice(0, name.length - ext.length)
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${stem}-${i}${ext}`
    if (!(await exists(path.join(dir, candidate)))) return candidate
  }
  throw new Error(`Too many files named ${name}`)
}

export interface FileStore {
  saveAttachment(taskId: string, name: string, bytes: Buffer): Promise<StoredFile>
  saveArtifact(runId: string, name: string, bytes: Buffer): Promise<StoredFile>
  readArtifact(runId: string, name: string): Promise<Buffer | undefined>
}

export function createFileStore(dataDir: string): FileStore {
  async function save(dir: string, rawName: string, bytes: Buffer): Promise<StoredFile> {
    await mkdir(dir, { recursive: true })
    const name = await uniqueName(dir, safeFileName(rawName))
    const storedPath = path.join(dir, name)
    await writeFile(storedPath, bytes)
    return { name, size: bytes.byteLength, storedPath }
  }

  return {
    saveAttachment(taskId, name, bytes) {
      return save(path.join(dataDir, "uploads", safeFileName(taskId)), name, bytes)
    },
    saveArtifact(runId, name, bytes) {
      return save(path.join(dataDir, "artifacts", safeFileName(runId)), name, bytes)
    },
    async readArtifact(runId, name) {
      const dir = path.join(dataDir, "artifacts", safeFileName(runId))
      const filePath = path.join(dir, name)
      if (path.dirname(filePath) !== dir) return undefined
      try {
        return await readFile(filePath)
      } catch {
        return undefined
      }
    },
  }
}
