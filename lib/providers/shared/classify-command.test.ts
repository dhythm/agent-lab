import { describe, expect, it } from "vitest"
import { classifyCommand, isTestCommand, parsePatchPaths, unwrapShellCommand } from "./classify-command"

describe("isTestCommand", () => {
  it.each([
    "pnpm test",
    "pnpm run test -- --run",
    "npm test",
    "yarn test",
    "npx vitest run",
    "pytest tests/",
    "go test ./...",
    "cargo test",
    "bun test",
  ])("detects %s", (command) => {
    expect(isTestCommand(command)).toBe(true)
  })

  it.each(["pnpm install", "ls -la", "git status", "cat src/test-utils.ts"])(
    "rejects %s",
    (command) => {
      expect(isTestCommand(command)).toBe(false)
    },
  )
})

describe("classifyCommand", () => {
  it("maps test runners to test", () => {
    expect(classifyCommand("pnpm test")).toBe("test")
  })

  it("maps read-only file viewers to file_read", () => {
    expect(classifyCommand("cat src/middleware.ts")).toBe("file_read")
    expect(classifyCommand("sed -n '1,40p' src/a.ts")).toBe("file_read")
    expect(classifyCommand("head -n 20 README.md")).toBe("file_read")
  })

  it("maps search tools to search", () => {
    expect(classifyCommand('grep -rn "session" src/')).toBe("search")
    expect(classifyCommand("rg getSession")).toBe("search")
    expect(classifyCommand("find . -name '*.ts'")).toBe("search")
    expect(classifyCommand("ls -la src")).toBe("search")
  })

  it("maps apply_patch to file_write", () => {
    expect(classifyCommand("apply_patch <<'EOF'\n*** Begin Patch\n*** Update File: src/a.ts\n*** End Patch\nEOF")).toBe("file_write")
  })

  it("defaults to shell", () => {
    expect(classifyCommand("pnpm install")).toBe("shell")
    expect(classifyCommand("git checkout -b fix")).toBe("shell")
  })
})

describe("parsePatchPaths", () => {
  it("extracts updated and added file paths from an apply_patch body", () => {
    const body = [
      "*** Begin Patch",
      "*** Update File: src/middleware.ts",
      "@@",
      "+ code",
      "*** Add File: src/middleware.test.ts",
      "+ test",
      "*** Delete File: src/old.ts",
      "*** End Patch",
    ].join("\n")
    expect(parsePatchPaths(body)).toEqual([
      "src/middleware.ts",
      "src/middleware.test.ts",
      "src/old.ts",
    ])
  })

  it("returns an empty list when nothing matches", () => {
    expect(parsePatchPaths("echo hi")).toEqual([])
  })
})

describe("unwrapShellCommand", () => {
  it("removes bash -lc wrappers and outer quotes", () => {
    expect(unwrapShellCommand("/bin/bash -lc 'ls -la /workspace'")).toBe("ls -la /workspace")
    expect(unwrapShellCommand('/bin/bash -lc "pwd && rg --files -g \\"x\\""')).toBe('pwd && rg --files -g "x"')
    expect(unwrapShellCommand("bash -c \"pnpm test\"")).toBe("pnpm test")
  })

  it("leaves plain commands untouched", () => {
    expect(unwrapShellCommand("  git status ")).toBe("git status")
  })

  it("classifies through the wrapper", () => {
    expect(classifyCommand("/bin/bash -lc 'pnpm test'")).toBe("test")
    expect(classifyCommand("/bin/bash -lc \"cat README.md\"")).toBe("file_read")
  })
})
