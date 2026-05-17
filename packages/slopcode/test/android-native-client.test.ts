import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

describe("Android native client", () => {
  test("talks to the local daemon API", async () => {
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-client-"))
    try {
      const bin = path.join(dir, "slopcode-termux")
      const build = Bun.spawn(["rustc", "native/android-client/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const seen: string[] = []
      const server = Bun.serve({
        port: 0,
        fetch: async (req: Request) => {
          const url = new URL(req.url)
          seen.push(`${req.method} ${url.pathname}`)
          if (url.pathname === "/session/") return Response.json({ id: "ses_test" })
          if (url.pathname === "/session/ses_test/message") {
            const body = (await req.json()) as { parts: Array<{ text: string }> }
            return Response.json({
              info: { role: "assistant" },
              parts: [{ type: "text", text: `echo ${body.parts[0].text}` }],
            })
          }
          return new Response("not found", { status: 404 })
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test", "--prompt", "hello"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        proc.stdin.write("/exit\n")
        proc.stdin.end()
        const [code, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()])
        expect(stderr).toBe("")
        expect(code).toBe(0)
        expect(stdout).toContain("SlopCode native Termux client")
        expect(stdout).toContain("assistant> echo hello")
        expect(seen).toContain("POST /session/")
        expect(seen).toContain("POST /session/ses_test/message")
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
