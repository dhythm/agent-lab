import type { AgentEventType } from "@/lib/agent-lab/types"

const TEST_PATTERNS: RegExp[] = [
  /\b(pnpm|npm|yarn|bun)\s+(run\s+)?test\b/,
  /\b(npx\s+)?(vitest|jest|mocha|ava)\b/,
  /\bpytest\b/,
  /\bgo\s+test\b/,
  /\bcargo\s+test\b/,
  /\bmvn\s+test\b/,
  /\bgradle\s+test\b/,
]

export function isTestCommand(command: string): boolean {
  return TEST_PATTERNS.some((pattern) => pattern.test(command))
}

const READ_PATTERN = /^\s*(cat|head|tail|less|more|bat|sed\s+-n)\b/
const SEARCH_PATTERN = /^\s*(grep|rg|ag|find|fd|ls|tree|git\s+(grep|ls-files))\b/
const PATCH_PATTERN = /(^\s*apply_patch\b|\*\*\* Begin Patch)/m

export function classifyCommand(command: string): AgentEventType {
  if (PATCH_PATTERN.test(command)) return "file_write"
  if (isTestCommand(command)) return "test"
  if (READ_PATTERN.test(command)) return "file_read"
  if (SEARCH_PATTERN.test(command)) return "search"
  return "shell"
}

const PATCH_FILE_PATTERN = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm

export function parsePatchPaths(body: string): string[] {
  const paths: string[] = []
  for (const match of body.matchAll(PATCH_FILE_PATTERN)) {
    const filePath = match[1].trim()
    if (filePath && !paths.includes(filePath)) paths.push(filePath)
  }
  return paths
}
