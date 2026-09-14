import { NextResponse } from "next/server"
import { getService } from "@/lib/agent-lab/service"

export const runtime = "nodejs"

export async function GET() {
  const { config, availableProviders } = getService()
  return NextResponse.json({
    providers: {
      openai: { enabled: config.openai.enabled, model: config.openai.model },
      anthropic: { enabled: config.anthropic.enabled, model: config.anthropic.model },
    },
    availableProviders,
    githubTokenConfigured: Boolean(config.githubToken),
  })
}
