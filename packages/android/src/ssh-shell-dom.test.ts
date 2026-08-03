import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

async function ready(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await fetch(url).then((response) => response.ok).catch(() => false)) return
    await Bun.sleep(100)
  }
  throw new Error("Vite did not start the SSH shell DOM fixture")
}

describe("SSH shell Android Back DOM contract", () => {
  test("discovers an open drawer without weakening its aria or inert state", async () => {
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
        ["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=1500", "--dump-dom", url],
        { stdout: "pipe", stderr: "ignore" },
      )
      const html = await new Response(chrome.stdout).text()
      expect(await chrome.exited).toBe(0)
      expect(html).toContain('data-drawer-open="true"')
      expect(html).toContain('data-aria-hidden="false"')
      expect(html).toContain('data-inert="false"')
      expect(html).toContain('data-back="handled"')
      expect(html).toContain('data-closed="true"')
    } finally {
      server.kill()
      await server.exited
    }
  }, 30_000)
})
