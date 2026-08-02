import { expect, test } from "bun:test"
import { canValidateSidecar, cliResource, getCurrentSidecar, sidecarExecutable } from "./utils"

test("maps every desktop target to a platform CLI package", () => {
  expect(getCurrentSidecar("aarch64-apple-darwin")).toMatchObject({
    package: "slopcode-bin-darwin-arm64",
    os: "darwin",
    cpu: "arm64",
  })
  expect(getCurrentSidecar("x86_64-apple-darwin")).toMatchObject({
    package: "slopcode-bin-darwin-x64-baseline",
    os: "darwin",
    cpu: "x64",
  })
  expect(getCurrentSidecar("aarch64-pc-windows-msvc")).toMatchObject({
    package: "slopcode-bin-windows-arm64",
    os: "win32",
    cpu: "arm64",
  })
  expect(getCurrentSidecar("x86_64-pc-windows-msvc")).toMatchObject({
    package: "slopcode-bin-windows-x64-baseline",
    os: "win32",
    cpu: "x64",
  })
  expect(getCurrentSidecar("x86_64-unknown-linux-gnu")).toMatchObject({
    package: "slopcode-bin-linux-x64-baseline",
    os: "linux",
    cpu: "x64",
  })
  expect(getCurrentSidecar("aarch64-unknown-linux-gnu")).toMatchObject({
    package: "slopcode-bin-linux-arm64",
    os: "linux",
    cpu: "arm64",
  })
})

test("names and stages the CLI for the Rust target instead of the build host", () => {
  expect(sidecarExecutable("x86_64-unknown-linux-gnu")).toBe("slopcode-cli")
  expect(sidecarExecutable("x86_64-apple-darwin")).toBe("slopcode-cli")
  expect(sidecarExecutable("x86_64-pc-windows-msvc")).toBe("slopcode-cli.exe")
  expect(cliResource("x86_64-pc-windows-msvc")).toEqual({
    from: "resources/slopcode-cli.exe",
    to: "slopcode-cli.exe",
  })
  expect(canValidateSidecar("x86_64-unknown-linux-gnu", { platform: "linux", arch: "x64" })).toBe(true)
  expect(canValidateSidecar("aarch64-unknown-linux-gnu", { platform: "linux", arch: "arm64" })).toBe(true)
  expect(canValidateSidecar("aarch64-unknown-linux-gnu", { platform: "linux", arch: "x64" })).toBe(false)
  expect(canValidateSidecar("x86_64-apple-darwin", { platform: "linux", arch: "x64" })).toBe(false)
  expect(canValidateSidecar("x86_64-pc-windows-msvc", { platform: "linux", arch: "x64" })).toBe(false)
})
