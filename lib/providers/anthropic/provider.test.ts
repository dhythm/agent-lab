import { describe, expect, it } from "vitest"
import { sessionOutputError } from "./provider"

describe("sessionOutputError", () => {
  it("accepts a session that produced a final message", () => {
    expect(sessionOutputError('{"title":"x"}', false)).toBeUndefined()
  })

  it("reports the failed model request rather than an empty output", () => {
    expect(sessionOutputError("", true)?.message).toMatch(/model request failed/i)
  })

  it("allows a tool-only session that ends without a message", () => {
    expect(sessionOutputError("   ", false)).toBeUndefined()
  })
})
