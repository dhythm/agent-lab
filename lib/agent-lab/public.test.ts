import { describe, expect, it } from "vitest"
import { toPublicTask } from "./public"
import type { AgentTask } from "./types"

describe("toPublicTask", () => {
  it("does not expose server-side system instructions", () => {
    const task: AgentTask = {
      id: "task",
      title: "SEO proofreading",
      systemPrompt: "Hidden system instructions",
      prompt: "User input",
      type: "seo-proofread",
      createdAt: "2026-09-17T00:00:00.000Z",
    }

    expect(toPublicTask(task)).not.toHaveProperty("systemPrompt")
    expect(toPublicTask(task)).toMatchObject({ prompt: "User input" })
  })
})
