import { describe, expect, it } from "vitest"
import { formatCost, formatDuration, formatTokens } from "./format"

describe("formatDuration", () => {
  it("formats milliseconds into m/s", () => {
    expect(formatDuration(0)).toBe("0s")
    expect(formatDuration(8_400)).toBe("8.4s")
    expect(formatDuration(65_000)).toBe("1m 05s")
    expect(formatDuration(3_725_000)).toBe("1h 02m")
  })

  it("returns a dash for missing values", () => {
    expect(formatDuration(undefined)).toBe("—")
  })
})

describe("formatCost", () => {
  it("formats dollars with sensible precision", () => {
    expect(formatCost(0.8412)).toBe("$0.84")
    expect(formatCost(0.0031)).toBe("$0.003")
    expect(formatCost(12)).toBe("$12.00")
    expect(formatCost(undefined)).toBe("—")
  })
})

describe("formatTokens", () => {
  it("abbreviates large counts", () => {
    expect(formatTokens(512)).toBe("512")
    expect(formatTokens(15_300)).toBe("15.3k")
    expect(formatTokens(2_100_000)).toBe("2.1M")
    expect(formatTokens(undefined)).toBe("—")
  })
})
