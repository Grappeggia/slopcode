import { describe, expect, test } from "bun:test"
import { BunRuntime } from "../../src/bun/runtime"

describe("bun runtime", () => {
  test("keeps bun exec paths", () => {
    expect(BunRuntime.which({ exec_path: "/tmp/bun" })).toBe("/tmp/bun")
    expect(BunRuntime.which({ exec_path: "C:/tools/bun.exe" })).toBe("C:/tools/bun.exe")
  })

  test("prefers configured bun path for packaged binaries", () => {
    expect(
      BunRuntime.which({
        exec_path: "/opt/slopcode/bin/slopcode",
        bun_path: "/opt/bun/bin/bun",
        lookup: "/usr/bin/bun",
      }),
    ).toBe("/opt/bun/bin/bun")
  })

  test("falls back to bun on path for packaged binaries", () => {
    expect(
      BunRuntime.which({
        exec_path: "/opt/slopcode/bin/slopcode",
        lookup: "/usr/bin/bun",
      }),
    ).toBe("/usr/bin/bun")
  })
})
