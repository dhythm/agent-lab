import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { CompletionRequest, CompletionResult, StructuredCompleter } from "./write-article"

const MAX_OUTPUT_TOKENS = 32_000

function describeApiError(provider: string, error: unknown): Error {
  if (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError) {
    return new Error(`${provider} API error ${error.status ?? ""}: ${error.message}`.replace(/\s+:/, ":"))
  }
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Claude via the Messages API with structured outputs. The system prompt is the
 * fixed template, so it is marked as a cache breakpoint; only the user message varies.
 */
export function createAnthropicCompleter(model: string, client = new Anthropic()): StructuredCompleter {
  return {
    id: "anthropic",
    model,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      let message: Anthropic.Message
      try {
        message = await client.messages
          .stream({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
            messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
            output_config: { effort: "high", format: { type: "json_schema", schema: request.schema } },
          }, { signal: request.signal })
          .finalMessage()
      } catch (error) {
        throw describeApiError("Anthropic", error)
      }
      if (message.stop_reason === "refusal") {
        throw new Error(`Anthropic refused the request${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ""}`)
      }
      if (message.stop_reason === "max_tokens") {
        throw new Error(`Anthropic reply was cut off at ${MAX_OUTPUT_TOKENS} output tokens`)
      }
      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
      const usage = message.usage
      return {
        text,
        usage: {
          inputTokens: usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
          outputTokens: usage.output_tokens,
          cachedInputTokens: usage.cache_read_input_tokens ?? 0,
        },
      }
    },
  }
}

/** OpenAI via the Responses API with a strict JSON schema text format. */
export function createOpenAICompleter(model: string, client = new OpenAI()): StructuredCompleter {
  return {
    id: "openai",
    model,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      let response: OpenAI.Responses.Response
      try {
        response = await client.responses.create({
          model,
          instructions: request.system,
          input: request.messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: MAX_OUTPUT_TOKENS,
          text: { format: { type: "json_schema", name: "article", schema: request.schema, strict: true } },
        }, { signal: request.signal })
      } catch (error) {
        throw describeApiError("OpenAI", error)
      }
      if (response.incomplete_details?.reason) {
        throw new Error(`OpenAI reply was incomplete: ${response.incomplete_details.reason}`)
      }
      const refusal = response.output
        .flatMap((item) => (item.type === "message" ? item.content : []))
        .find((part) => part.type === "refusal")
      if (refusal) throw new Error(`OpenAI refused the request: ${refusal.refusal}`)
      return {
        text: response.output_text,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
        },
      }
    },
  }
}
