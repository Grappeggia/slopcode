import { describe, expect, test } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import { eventually, start } from "./editor-e2e"

const token = "prompt-slash-new-token"
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

describe("prompt slash new e2e", () => {
  test("opens a fresh draft without carrying /new into the next prompt", async () => {
    await using tmp = await tmpdir({ git: true })
    const app = await start({
      title: "Prompt Slash New",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "prompt-slash-new",
    })

    try {
      await ready(app, "Prompt Slash New")

      app.pty.write("/new\r")

      await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        if (!screen.includes("/new") || !screen.includes("New session")) return
        return screen
      }, 10_000).catch(() => {
        throw new Error(app.text())
      })

      app.pty.write("\r")

      const opened = await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        if (!screen.includes("New Session")) return
        if (screen.includes("/new")) return
        return screen
      }, 10_000).catch(() => {
        throw new Error(app.text())
      })

      expect(opened).not.toContain("/new")

      app.pty.write("after")

      const typed = await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        if (!screen.includes("after")) return
        if (screen.includes("/newafter") || screen.includes("/new after")) return
        return screen
      }, 5_000).catch(() => {
        throw new Error(app.text())
      })

      expect(typed).toContain("after")
      expect(typed).not.toContain("/new")
    } finally {
      await app.stop()
    }
  }, 30_000)
})
