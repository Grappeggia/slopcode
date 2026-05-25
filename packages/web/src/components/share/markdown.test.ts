import { describe, expect, test } from "bun:test"
import { renderMarkdown, safeHref } from "./markdown"

describe("share markdown", () => {
  test("allows safe hrefs and rejects dangerous ones", () => {
    expect(safeHref("https://slopcode.dev/docs")).toBe("https://slopcode.dev/docs")
    expect(safeHref("/docs/install")).toBe("/docs/install")
    expect(safeHref("#usage")).toBe("#usage")
    expect(safeHref("javascript:alert(1)")).toBeUndefined()
    expect(safeHref("data:text/html,<svg/onload=alert(1)>")).toBeUndefined()
    expect(safeHref("//evil.example.com")).toBeUndefined()
  })

  test("escapes raw html blocks", async () => {
    const html = await renderMarkdown("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  test("drops unsafe markdown links", async () => {
    const html = await renderMarkdown("[click me](javascript:alert(1))")
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("javascript:alert(1)")
    expect(html).toContain("click me")
  })

  test("drops unsafe markdown images", async () => {
    const html = await renderMarkdown("![boom](data:image/svg+xml,<svg/onload=alert(1)>)")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("data:image/svg+xml")
    expect(html).toContain("boom")
  })
})
