import { describe, expect, it } from "vitest"
import { buildTaskPrompt, normalizeRepositoryUrl } from "./task-prompt"
import type { AgentTask } from "@/lib/agent-lab/types"

const base: AgentTask = {
  id: "t",
  title: "x",
  prompt: "Add a redirect for logged-in users.",
  type: "coding",
  createdAt: "2026-09-14T00:00:00.000Z",
}

describe("normalizeRepositoryUrl", () => {
  it("expands owner/repo shorthand", () => {
    expect(normalizeRepositoryUrl("dhythm/agent-lab-fixture")).toBe(
      "https://github.com/dhythm/agent-lab-fixture",
    )
  })

  it("keeps full URLs and strips a trailing .git", () => {
    expect(normalizeRepositoryUrl("https://github.com/a/b.git")).toBe("https://github.com/a/b")
    expect(normalizeRepositoryUrl("https://github.com/a/b/")).toBe("https://github.com/a/b")
  })

  it("returns undefined for empty input", () => {
    expect(normalizeRepositoryUrl("")).toBeUndefined()
    expect(normalizeRepositoryUrl(undefined)).toBeUndefined()
  })
})

describe("buildTaskPrompt", () => {
  it("includes the user prompt and repository location", () => {
    const text = buildTaskPrompt(
      { ...base, repository: "a/b", branch: "main" },
      { workspacePath: "/workspace/b" },
    )
    expect(text).toContain("Add a redirect for logged-in users.")
    expect(text).toContain("/workspace/b")
    expect(text).toContain("main")
  })

  it("adds coding guidance for coding tasks", () => {
    expect(buildTaskPrompt(base, {})).toMatch(/run the existing tests/i)
  })

  it("asks for a report file for research tasks", () => {
    expect(buildTaskPrompt({ ...base, type: "research" }, { outputDir: "/mnt/session/outputs" })).toContain(
      "/mnt/session/outputs",
    )
  })
})
