import { describe, expect, test } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import { eventually, start } from "./editor-e2e"

const token = "dialog-slash-context-token"
const width = 140
const height = 40

function ready(app: Awaited<ReturnType<typeof start>>, title: string) {
  return eventually(() => {
    const screen = app.text()
    if (!screen.includes(title) || !screen.includes("📂")) return
    return screen
  }, 15_000)
}

function crash(screen: string) {
  return screen.includes("A fatal error occurred!") || screen.includes("context must be used within a context provider")
}

async function open(input: { slash: string; title: string; extra?: string }) {
  await using tmp = await tmpdir({ git: true })
  const app = await start({
    title: "Dialog Slash Context",
    directory: tmp.path,
    token,
    width,
    height,
    script_name: `dialog-slash-context-${input.title.toLowerCase().replace(/\s+/g, "-")}`,
  })

  try {
    await ready(app, "Dialog Slash Context")
    app.pty.write(`${input.slash}\r`)

    await eventually(() => {
      const screen = app.text()
      if (crash(screen)) throw new Error(screen)
      if (!screen.includes(input.slash)) return
      return screen
    }, 10_000).catch(() => {
      throw new Error(app.text())
    })

    app.pty.write("\r")

    const screen = await eventually(() => {
      const screen = app.text()
      if (crash(screen)) throw new Error(screen)
      if (!screen.includes(input.title)) return
      if (input.extra && !screen.includes(input.extra)) return
      return screen
    }, 10_000).catch(() => {
      throw new Error(app.text())
    })

    expect(screen).toContain(input.title)
    expect(screen).not.toContain("A fatal error occurred!")
    expect(screen).not.toContain("context must be used within a context provider")
  } finally {
    await app.stop()
  }
}

describe("dialog slash context e2e", () => {
  test("opens session dialog without losing context", async () => {
    await open({ slash: "/session", title: "Sessions" })
  }, 20_000)

  test("opens model dialog without losing context", async () => {
    await open({ slash: "/models", title: "Select model" })
  }, 20_000)

  test("opens help dialog without losing command context", async () => {
    await open({ slash: "/help", title: "Help", extra: "show commands" })
  }, 20_000)
})
