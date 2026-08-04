import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

async function ready(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (
      await fetch(url)
        .then((response) => response.ok)
        .catch(() => false)
    )
      return
    await Bun.sleep(100)
  }
  throw new Error("Vite did not start the SSH agentic session DOM fixture")
}

describe("SSH agentic session rendered DOM journey", () => {
  test("renders and restores the complete message-first interaction journey", async () => {
    const port = 41742
    const server = Bun.spawn(["bunx", "vite", "--host", "127.0.0.1", "--port", `${port}`, "--strictPort"], {
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    })
    const url = `http://127.0.0.1:${port}/ssh-agentic-session-dom-fixture.html`
    try {
      await ready(url)
      const chrome = Bun.spawn(
        [
          "google-chrome",
          "--headless=new",
          "--no-sandbox",
          "--disable-gpu",
          "--window-size=390,844",
          "--force-device-scale-factor=1",
          "--virtual-time-budget=8000",
          "--dump-dom",
          url,
        ],
        { stdout: "pipe", stderr: "ignore" },
      )
      const html = await new Response(chrome.stdout).text()
      expect(await chrome.exited).toBe(0)
      expect(html).not.toContain("data-fixture-error=")
      expect(html).toContain('data-first-viewport="true"')
      expect(html).toContain('data-review-labels="Changes|Files|Tests|Screenshots"')
      expect(html).toContain('data-empty-states="true"')
      expect(html).toContain('data-immediate-prompt="true"')
      expect(html).toContain('data-streamed-entries="true"')
      expect(html).toContain('data-approval="true"')
      expect(html).toContain('data-question="true"')
      expect(html).toContain('data-scroll-follow="true"')
      expect(html).toContain('data-review-projection="true"')
      expect(html).toContain('data-artifact-projection="true"')
      expect(html).toContain('data-completion-live="true"')
      expect(html).toContain('data-attached-restore="true"')
      expect(html).toContain('data-new-session="true"')
      expect(html).toContain('data-fixture-complete="true"')
    } finally {
      server.kill()
      await server.exited
    }
  }, 30_000)
})
