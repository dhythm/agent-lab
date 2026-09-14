const DASH = "—"

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return DASH
  const seconds = ms / 1000
  if (seconds < 60) return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`
}

export function formatCost(usd: number | undefined): string {
  if (usd === undefined || !Number.isFinite(usd)) return DASH
  if (usd > 0 && usd < 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

export function formatTokens(count: number | undefined): string {
  if (count === undefined || !Number.isFinite(count)) return DASH
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function formatCount(count: number | undefined): string {
  return count === undefined ? DASH : String(count)
}
