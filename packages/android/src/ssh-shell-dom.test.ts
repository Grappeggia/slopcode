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
  throw new Error("Vite did not start the SSH shell DOM fixture")
}

describe("SSH shell modal drawer DOM contract", () => {
  test("keeps open and closed marker, inert, aria, and focus state consistent", async () => {
    const port = 41741
    const server = Bun.spawn(["bunx", "vite", "--host", "127.0.0.1", "--port", `${port}`, "--strictPort"], {
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    })
    const url = `http://127.0.0.1:${port}/ssh-shell-dom-fixture.html`
    try {
      await ready(url)
      const chrome = Bun.spawn(
        [
          "google-chrome",
          "--headless=new",
          "--no-sandbox",
          "--disable-gpu",
          "--virtual-time-budget=1500",
          "--dump-dom",
          url,
        ],
        { stdout: "pipe", stderr: "ignore" },
      )
      const html = await new Response(chrome.stdout).text()
      expect(await chrome.exited).toBe(0)
      expect(html).toContain('data-drawer-open="true"')
      expect(html).toContain('data-aria-hidden="false"')
      expect(html).toContain('data-aria-modal="true"')
      expect(html).toContain('data-inert="false"')
      expect(html).toContain('data-content-hidden="true"')
      expect(html).toContain('data-content-inert="true"')
      expect(html).toContain('data-open-focus="Close navigation"')
      expect(html).toContain('data-trap-focus="theme"')
      expect(html).toContain('data-back="handled"')
      expect(html).toContain('data-closed-open=""')
      expect(html).toContain('data-closed-hidden="true"')
      expect(html).toContain('data-closed-inert="true"')
      expect(html).toContain('data-closed-content-hidden="false"')
      expect(html).toContain('data-closed-content-inert="false"')
      expect(html).toContain('data-closed-focus="Open navigation"')
    } finally {
      server.kill()
      await server.exited
    }
  }, 30_000)
})
