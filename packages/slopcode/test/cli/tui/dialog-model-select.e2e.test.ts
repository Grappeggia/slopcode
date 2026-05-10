import { describe, expect, test } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import { click, eventually, locate, start } from "./editor-e2e"

const token = "dialog-model-select-token"
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

function footer(screen: string) {
  return screen.split("\n").find((line) => line.includes("  Build  ")) ?? ""
}

function candidate(screen: string) {
  const lines = screen.split("\n")
  const start = lines.findIndex((line) => line.includes("Select model"))
  const end = lines.findIndex((line) => line.includes("ctrl+a"))
  if (start === -1 || end === -1 || end <= start) return

  const current = lines
    .slice(start + 1, end)
    .find((line) => line.includes("●"))
    ?.replace("●", "")
    .trim()

  return lines
    .slice(start + 1, end)
    .map((line) => line.replace("●", "").trim())
    .find((line) => line && /[0-9]/.test(line) && line !== current)
}

describe("dialog model select e2e", () => {
  test("selects a model from the slash dialog and returns focus to the prompt", async () => {
    await using tmp = await tmpdir({ git: true })
    const app = await start({
      title: "Dialog Model Select",
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "dialog-model-select",
    })

    try {
      await ready(app, "Dialog Model Select")
      const before = footer(app.text())

      app.pty.write("/models\r")

      await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        if (!screen.includes("/models") || !screen.includes("Switch model")) return
        return screen
      }, 10_000).catch(() => {
        throw new Error(app.text())
      })

      app.pty.write("\r")

      const open = await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        if (!screen.includes("Select model")) return
        return screen
      }, 10_000).catch(() => {
        throw new Error(app.text())
      })

      const next = await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        const next = candidate(screen)
        if (!next) return
        return next
      }, 10_000).catch(() => {
        throw new Error(app.text())
      })
      const hit = locate(app.screen(), next)
      expect(hit).toBeDefined()
      click(app.pty, hit!.row, hit!.col + 2)

      const closed = await eventually(() => {
        const screen = app.text()
        if (crash(screen)) throw new Error(screen)
        if (screen.includes("Select model")) return
        const after = footer(screen)
        if (!after || after === before) return
        return screen
      }, 10_000).catch(() => {
        throw new Error(app.text())
      })

      expect(footer(closed)).not.toBe(before)
      expect(closed).not.toContain("A fatal error occurred!")
      expect(closed).not.toContain("context must be used within a context provider")

      app.pty.write("postpick")

      const typed = await eventually(() => {
        const screen = app.text()
        if (!screen.includes("postpick")) return
        return screen
      }, 5_000).catch(() => {
        throw new Error(app.text())
      })

      expect(typed).toContain("postpick")
    } finally {
      await app.stop()
    }
  }, 30_000)
})
