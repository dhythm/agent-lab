import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createFileStore, safeFileName } from "./files"

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "agent-lab-files-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("safeFileName", () => {
  it("strips directories and unsafe characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd")
    expect(safeFileName("sales 2026 (final).csv")).toBe("sales_2026_final.csv")
    expect(safeFileName("売上.csv")).toBe("売上.csv")
    expect(safeFileName("")).toBe("file")
  })
})

describe("file store", () => {
  it("saves attachments under the task and returns metadata", async () => {
    const store = createFileStore(dir)
    const saved = await store.saveAttachment("task_1", "data.csv", Buffer.from("a,b\n1,2\n"))
    expect(saved.name).toBe("data.csv")
    expect(saved.size).toBe(8)
    expect(saved.storedPath).toBe(path.join(dir, "uploads", "task_1", "data.csv"))
    expect(await readFile(saved.storedPath, "utf8")).toBe("a,b\n1,2\n")
  })

  it("saves artifacts under the run, flattening nested paths", async () => {
    const store = createFileStore(dir)
    const saved = await store.saveArtifact("run_1", "/workspace/outputs/report.md", Buffer.from("# hi"))
    expect(saved.name).toBe("report.md")
    expect(saved.storedPath).toBe(path.join(dir, "artifacts", "run_1", "report.md"))
  })

  it("resolves an artifact by name without escaping the run directory", async () => {
    const store = createFileStore(dir)
    await store.saveArtifact("run_1", "report.md", Buffer.from("# hi"))
    expect(await store.readArtifact("run_1", "report.md")).toEqual(Buffer.from("# hi"))
    expect(await store.readArtifact("run_1", "../run_2/x")).toBeUndefined()
    expect(await store.readArtifact("run_1", "missing.md")).toBeUndefined()
  })

  it("disambiguates duplicate names", async () => {
    const store = createFileStore(dir)
    const a = await store.saveArtifact("run_1", "report.md", Buffer.from("1"))
    const b = await store.saveArtifact("run_1", "report.md", Buffer.from("2"))
    expect(a.name).toBe("report.md")
    expect(b.name).toBe("report-2.md")
  })
})
