import { describe, expect, it } from "vitest"
import { providerConfigs } from "@/lib/agent-lab-data"
import { loadConfig } from "./config"

describe("loadConfig", () => {
  it("defaults the OpenAI Agents API model to gpt-5.6-sol with Sol list prices", () => {
    const config = loadConfig({})
    expect(config.openai.model).toBe("gpt-5.6-sol")
    expect(config.openai.inputPricePerMillion).toBe(4)
    expect(config.openai.outputPricePerMillion).toBe(20)
  })

  it("allows the OpenAI model and prices to be overridden via env", () => {
    const config = loadConfig({
      OPENAI_AGENT_MODEL: "gpt-6-astra",
      OPENAI_INPUT_PRICE_PER_MILLION: "10",
      OPENAI_OUTPUT_PRICE_PER_MILLION: "50",
    })
    expect(config.openai.model).toBe("gpt-6-astra")
    expect(config.openai.inputPricePerMillion).toBe(10)
    expect(config.openai.outputPricePerMillion).toBe(50)
  })
})

describe("providerConfigs", () => {
  it("shows gpt-5.6-sol as the OpenAI display model", () => {
    expect(providerConfigs.openai.model).toBe("gpt-5.6-sol")
  })
})
