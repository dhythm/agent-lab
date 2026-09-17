import { describe, expect, it } from "vitest"
import type { AgentTask } from "@/lib/agent-lab/types"
import { AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA } from "@/lib/agent-lab/seo-output"
import { openAIAgentText } from "./provider"

function task(type: AgentTask["type"]): AgentTask {
  return {
    id: "task_1",
    title: "Test",
    prompt: "Test",
    type,
    createdAt: "2026-09-17T00:00:00.000Z",
  }
}

describe("openAIAgentText", () => {
  it("uses strict structured output for SEO proofreading", () => {
    expect(openAIAgentText(task("seo-proofread"))).toEqual({
      format: {
        type: "json_schema",
        schema: AUTO_POST_AI_REVIEW_RESPONSE_JSON_SCHEMA.schema,
      },
    })
  })

  it("does not constrain other task outputs", () => {
    expect(openAIAgentText(task("coding"))).toBeUndefined()
  })
})
