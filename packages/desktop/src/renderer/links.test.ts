import { describe, expect, test } from "bun:test"
import { handleLinkClick } from "./links"

function click(href: string, page = "oc://renderer/session", options: Record<string, boolean> = {}) {
  const opened: string[] = []
  let prevented = false
  const anchor = {
    getAttribute(name: string) {
      return name === "href" ? href : null
    },
  }
  const event = {
    target: {
      closest(selector: string) {
        return selector === "a[href]" ? anchor : null
      },
    },
    button: 0,
    defaultPrevented: false,
    preventDefault() {
      prevented = true
    },
    ...options,
  }

  handleLinkClick(event as never, page, (url) => opened.push(url))
  return { opened, prevented }
}

describe("desktop renderer links", () => {
  test("intercepts an absolute raw Markdown anchor without relying on its class", () => {
    expect(click("https://attacker.example/phish")).toEqual({
      opened: ["https://attacker.example/phish"],
      prevented: true,
    })
  })

  test("preserves production and development app/router links", () => {
    expect(click("/workspace/project")).toEqual({ opened: [], prevented: false })
    expect(click("#message-1")).toEqual({ opened: [], prevented: false })
    expect(click("http://localhost:5173/settings", "http://localhost:5173/session")).toEqual({
      opened: [],
      prevented: false,
    })
  })

  test("keeps internal modifier clicks untouched and externalizes modified web clicks", () => {
    expect(click("/workspace/project", "oc://renderer/session", { metaKey: true })).toEqual({
      opened: [],
      prevented: false,
    })
    expect(click("https://example.com/docs", "oc://renderer/session", { ctrlKey: true })).toEqual({
      opened: ["https://example.com/docs"],
      prevented: true,
    })
  })

  test("blocks unsafe absolute link schemes in the renderer", () => {
    for (const href of [
      "file:///tmp/secret",
      "javascript:alert(document.domain)",
      "data:text/html,hostile",
      "shell:open",
      "slopcode://session/secret",
    ]) {
      expect(click(href)).toEqual({ opened: [], prevented: true })
    }
  })

  test("respects link behavior already handled by an app component", () => {
    expect(click("https://example.com/", "oc://renderer/session", { defaultPrevented: true })).toEqual({
      opened: [],
      prevented: false,
    })
  })
})
