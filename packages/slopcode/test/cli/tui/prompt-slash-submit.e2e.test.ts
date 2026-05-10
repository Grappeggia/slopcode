import { describe, expect, test } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import { eventually, start } from "./editor-e2e"

const token = "prompt-slash-submit-token"
const width = 140
const height = 40

function ready(app: Awaited<ReturnType<typeof start>>, title: string) {
  return eventually(() => {
    const screen = app.text()
    if (!screen.includes(title) || !screen.includes("📂")) return
    return screen
  }, 15_000)
}

describe("prompt slash submit e2e", () => {
  test("enter on `/se` keeps slash options open instead of submitting raw text", async () => {
    await using tmp = await tmpdir({ git: true })
    const title = "Prompt Slash Submit"
    const app = await start({
      title,
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "prompt-slash-submit",
    })

    try {
      await ready(app, title)
      app.pty.write("/se\r")

      let last = ""
      const screen = await eventually(() => {
        last = app.text()
        if (!last.includes("/session") || !last.includes("Switch session") || !last.includes("/se")) return
        return last
      }, 10_000).catch(() => {
        throw new Error(last)
      })

      expect(screen).toContain("/session")
      expect(screen).toContain("Switch session")
      expect(screen).toContain("/se")
    } finally {
      await app.stop()
    }
  }, 20_000)

  test("enter on `/mo` selects the highlighted slash command", async () => {
    await using tmp = await tmpdir({ git: true })
    const title = "Prompt Slash Select"
    const app = await start({
      title,
      directory: tmp.path,
      token,
      width,
      height,
      script_name: "prompt-slash-select",
    })

    try {
      await ready(app, title)
      app.pty.write("/mo")

      await eventually(() => {
        const screen = app.text()
        if (!screen.includes("/move") || !screen.includes("Move session")) return
        return screen
      }, 10_000)

      app.pty.write("\r")

      let last = ""
      const screen = await eventually(() => {
        last = app.text()
        if (!last.includes("+ New workspace")) return
        return last
      }, 10_000).catch(() => {
        throw new Error(last)
      })

      expect(screen).toContain("+ New workspace")
    } finally {
      await app.stop()
    }
  }, 20_000)
})
