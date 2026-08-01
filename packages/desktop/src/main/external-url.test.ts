import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { resolveExternalURL, resolveLocalFilePath } from "./external-url"

describe("external URL resolution", () => {
  test("permits web and mail targets only", () => {
    expect(resolveExternalURL("https://example.com/a?b=c")).toBe("https://example.com/a?b=c")
    expect(resolveExternalURL("mailto:hello@slopcode.dev")).toBe("mailto:hello@slopcode.dev")
    expect(resolveExternalURL("file:///tmp/index.html")).toBeUndefined()
    expect(resolveExternalURL("javascript:alert(1)")).toBeUndefined()
  })

  test("rejects ambiguous or credential-bearing targets", () => {
    expect(resolveExternalURL(" https://example.com")).toBeUndefined()
    expect(resolveExternalURL("https://example.com\n")).toBeUndefined()
    expect(resolveExternalURL("https://user:pass@example.com")).toBeUndefined()
  })

  test("resolves local file URLs only", () => {
    const path = resolve("example.html")
    expect(resolveLocalFilePath(pathToFileURL(path).href)).toBe(path)
    expect(resolveLocalFilePath("file://example.com/share/index.html")).toBeUndefined()
    expect(resolveLocalFilePath("https://example.com/index.html")).toBeUndefined()
  })
})
