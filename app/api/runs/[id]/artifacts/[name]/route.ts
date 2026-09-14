import { getService } from "@/lib/agent-lab/service"

export const runtime = "nodejs"

const TYPES: Record<string, string> = {
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  html: "text/html; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await context.params
  const decoded = decodeURIComponent(name)
  const { store, files } = getService()
  const run = await store.getRun(id)
  const artifact = run?.result?.artifacts?.find((a) => a.name === decoded)
  if (!run || !artifact) return new Response("Artifact not found", { status: 404 })
  const bytes = await files.readArtifact(id, artifact.name)
  if (!bytes) return new Response("Artifact not found", { status: 404 })
  const ext = artifact.name.split(".").pop()?.toLowerCase() ?? ""
  const inline = new URL(request.url).searchParams.get("inline") === "1"
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(artifact.name)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
