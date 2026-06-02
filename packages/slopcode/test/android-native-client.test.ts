import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

describe("Android native client", () => {
  test("talks to the local daemon API", async () => {
    if (process.platform === "win32") return
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
          if (url.pathname === "/session") return Response.json({ id: "ses_test" })
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
        const proc = Bun.spawn(
          [bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test", "--prompt", "hello"],
          {
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
          },
        )
        proc.stdin.write("/exit\n")
        proc.stdin.end()
        const [code, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        expect(stderr).toBe("")
        expect(code).toBe(0)
        expect(stdout).toContain("SlopCode native Termux client")
        expect(stdout).toContain("assistant> echo hello")
        expect(seen).toContain("POST /session")
        expect(seen).toContain("POST /session/ses_test/message")
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("builds the native Android sidecar self-test", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const proc = Bun.spawn([bin, "--self-test"], { stdout: "pipe", stderr: "pipe" })
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(stdout).toContain("slopcode-android-host ok")
      const version = Bun.spawn([bin, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, SLOPCODE_VERSION: "1.2.3" },
      })
      expect(await version.exited).toBe(0)
      expect(await new Response(version.stdout).text()).toContain("1.2.3")

      const doctor = Bun.spawn([bin, "doctor", "android", "--json"], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, SLOPCODE_ANDROID_HOST_PATH: bin, SLOPCODE_VERSION: "1.2.3" },
      })
      const [doctorCode, doctorOut] = await Promise.all([doctor.exited, new Response(doctor.stdout).text()])
      expect(doctorCode).toBe(0)
      expect(JSON.parse(doctorOut)).toMatchObject({
        version: "1.2.3",
        strategy: "rust",
        renderer: "rust-native",
        targetRenderer: "ratatui/crossterm",
        sidecar: bin,
        sidecarExists: true,
        bun: null,
        ffiBlocked: false,
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("checks the Cargo Android TUI and doctor contract", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["cargo", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const root = path.join(import.meta.dir, "..")
    const target = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-android-tui-target-"))
    try {
      const build = Bun.spawn(["cargo", "check", "--manifest-path", "native/android-tui/Cargo.toml"], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, CARGO_TARGET_DIR: target },
      })
      const [buildCode, buildErr] = await Promise.all([build.exited, new Response(build.stderr).text()])
      if (buildCode !== 0 && buildErr.includes("Xcode license")) return
      expect(buildErr).not.toContain("error:")
      expect(buildCode).toBe(0)

      const entry = await Bun.file(path.join(root, "native", "android-tui", "src", "main.rs")).text()
      expect(entry).toContain("slopcode-android-tui ok")
      expect(entry).toContain("slopcode-android-host ok")
      expect(entry).toContain('"renderer": "ratatui/crossterm"')
      expect(entry).toContain('"tuiCoreVersion": TUI_CORE_VERSION')
      expect(entry).toContain('"termuxApi"')
    } finally {
      await fs.rm(target, { recursive: true, force: true })
    }
  })

  test("renders sidecar home and creates sessions lazily", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-home-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      let created = 0
      const bodies: Array<{ parts?: Array<{ text?: string }> }> = []
      const json = (value: unknown) =>
        new Response(JSON.stringify(value, null, 2), { headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        fetch: async (req: Request) => {
          const url = new URL(req.url)
          if (url.pathname === "/session" && req.method === "POST") {
            created++
            return json({ id: "ses_sidecar" })
          }
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Home Prompt Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname === "/session/ses_sidecar/prompt_async" && req.method === "POST") {
            bodies.push((await req.json()) as { parts?: Array<{ text?: string }> })
            return new Response(null, { status: 204 })
          }
          if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
          return json([])
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        await Bun.sleep(250)
        expect(created).toBe(0)
        proc.stdin.write("hello from home\r")
        await Bun.sleep(100)
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        if (code !== 0) throw new Error(stderr || stdout)
        expect(stdout).toContain("SlopCode")
        expect(stdout).toContain("Fix a TODO in the codebase")
        expect(stdout).not.toContain("info: connected")
        expect(stdout).not.toContain("SlopCode Android |")
        expect(created).toBe(1)
        expect(bodies[0]?.parts?.[0]?.text).toBe("hello from home")
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("submits sidecar prompt with server-compatible ID prefixes", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-prompt-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const bodies: Array<{
        messageID?: string
        parts?: Array<{ id?: string; type?: string; text?: string }>
      }> = []
      const json = (value: unknown, init?: ResponseInit) =>
        new Response(JSON.stringify(value), { ...init, headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        fetch: async (req: Request) => {
          const url = new URL(req.url)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Prompt Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname === "/session/ses_sidecar/prompt_async" && req.method === "POST") {
            bodies.push(
              (await req.json()) as {
                messageID?: string
                parts?: Array<{ id?: string; type?: string; text?: string }>
              },
            )
            return new Response(null, { status: 204 })
          }
          if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
          return json({})
        },
      })
      try {
        const proc = Bun.spawn(
          [bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test", "--prompt", "hello"],
          {
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
          },
        )
        proc.stdin.write("/exit\n")
        proc.stdin.end()
        const [code] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        expect(code).toBe(0)
        expect(bodies.length).toBe(1)
        expect(bodies[0]?.messageID?.startsWith("msg_")).toBe(true)
        expect(bodies[0]?.parts?.[0]?.id?.startsWith("prt_")).toBe(true)
        expect(bodies[0]?.parts?.[0]?.text).toBe("hello")
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("handles sidecar multiline paste, cursor editing, and history", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-input-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const bodies: Array<{ parts?: Array<{ text?: string }> }> = []
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Input Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname === "/session/ses_sidecar/prompt_async" && req.method === "POST") {
            bodies.push((await req.json()) as { parts?: Array<{ text?: string }> })
            return new Response(null, { status: 204 })
          }
          if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
          return json({})
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        await Bun.sleep(150)
        proc.stdin.write("\x1b[200~hello\nworld\x1b[201~\r")
        await Bun.sleep(150)
        proc.stdin.write("first\r")
        await Bun.sleep(150)
        proc.stdin.write("\x1b[A again\r")
        await Bun.sleep(150)
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        expect(code).toBe(0)
        expect(stdout).toContain("Input Session")
        expect(bodies.map((item) => item.parts?.[0]?.text)).toEqual(["hello\nworld", "first", "first again"])
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("answers sidecar question prompts", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-question-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const replies: Array<{ answers?: string[][] }> = []
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Question Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname === "/question/que_sidecar/reply" && req.method === "POST") {
            replies.push((await req.json()) as { answers?: string[][] })
            return json({})
          }
          if (url.pathname === "/event") {
            return new Response(
              'data: {"type":"question.asked","properties":{"id":"que_sidecar","sessionID":"ses_sidecar","questions":[{"header":"Mode","question":"Pick one","options":[{"label":"Yes","description":"ok"}]}]}}\n\n',
            )
          }
          return json({})
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        await Bun.sleep(250)
        proc.stdin.write("1\r")
        await Bun.sleep(100)
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        expect(code).toBe(0)
        expect(replies).toEqual([{ answers: [["Yes"]] }])
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("handles sidecar permission prompts", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-permission-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const replies: Array<{ id: string; body: { reply?: string } }> = []
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Permission Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname.startsWith("/permission/") && url.pathname.endsWith("/reply")) {
            replies.push({ id: url.pathname.split("/")[2] ?? "", body: (await req.json()) as { reply?: string } })
            return json({})
          }
          if (url.pathname === "/event") {
            return new Response(
              [
                'data: {"type":"permission.asked","properties":{"id":"perm_one","sessionID":"ses_sidecar","permission":"edit","patterns":["src/a.ts"],"metadata":{"filepath":"src/a.ts"}}}',
                'data: {"type":"permission.asked","properties":{"id":"perm_two","sessionID":"ses_sidecar","permission":"bash","patterns":["npm test"],"metadata":{"source":"terminal"}}}',
                "",
              ].join("\n\n"),
            )
          }
          return json({})
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        await Bun.sleep(250)
        proc.stdin.write("o")
        await Bun.sleep(50)
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
        expect(code).toBe(0)
        expect(stdout).toContain("permission")
        expect(replies).toEqual([{ id: "perm_two", body: { reply: "once" } }])
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("routes sidecar navigation, queue, stash, shell, and autocomplete commands", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-phase2-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const seen: string[] = []
      const shells: Array<{ command?: string; model?: { providerID?: string; modelID?: string } }> = []
      const summaries: Array<{ providerID?: string; modelID?: string }> = []
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url)
          seen.push(`${req.method} ${url.pathname}`)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session" && req.method === "GET")
            return json([{ id: "ses_sidecar", title: "Phase 2" }])
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Phase 2" })
          if (url.pathname === "/session/ses_sidecar/children") return json([{ id: "ses_child", title: "Child" }])
          if (url.pathname === "/session/ses_sidecar/message/index")
            return json([{ id: "msg_route", sessionID: "ses_sidecar", role: "user", time: { created: 1 } }])
          if (url.pathname === "/session/ses_sidecar/message/chunk") return json([])
          if (url.pathname === "/session/ses_sidecar/share" && req.method === "POST")
            return json({ id: "ses_sidecar", title: "Phase 2", share: { url: "https://share.example/ses_sidecar" } })
          if (url.pathname === "/session/ses_sidecar/share" && req.method === "DELETE")
            return json({ id: "ses_sidecar", title: "Phase 2" })
          if (url.pathname === "/session/ses_sidecar/pause" && req.method === "POST") return json(true)
          if (url.pathname === "/session/ses_sidecar/resume" && req.method === "POST") return json(true)
          if (url.pathname === "/session/ses_sidecar/abort" && req.method === "POST") return json(true)
          if (url.pathname === "/session/ses_sidecar/summarize" && req.method === "POST") {
            summaries.push((await req.json()) as { providerID?: string; modelID?: string })
            return json(true)
          }
          if (url.pathname === "/session/ses_sidecar/fork" && req.method === "POST")
            return json({ id: "ses_fork", title: "Forked Session" })
          if (url.pathname === "/session/ses_fork") return json({ id: "ses_fork", title: "Forked Session" })
          if (url.pathname === "/session/ses_fork/message/index") return json([])
          if (url.pathname === "/session/ses_sidecar/shell" && req.method === "POST") {
            shells.push((await req.json()) as { command?: string; model?: { providerID?: string; modelID?: string } })
            return json({ id: "msg_shell", sessionID: "ses_sidecar", role: "assistant" })
          }
          if (url.pathname === "/session/status") return json({ ses_sidecar: { type: "idle" } })
          if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
          return json({})
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        for (const input of [
          "/children\r",
          "/doctor\r",
          "/cl\t\u0015",
          "/messages\r",
          "/timeline\r",
          "/status\r",
          "/share\r",
          "/unshare\r",
          "/pause\r",
          "/resume\r",
          "/model openai/gpt-5\r",
          "/compact\r",
          "/interrupt\r",
          "/queue\r",
          "draft prompt\x1b[24~",
          "/list\r",
          "\x1b[25~\t\r",
          "/shell\r",
          "ls -la\r",
          "/fork\r",
        ]) {
          proc.stdin.write(input)
          await Bun.sleep(50)
        }
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
        expect(code).toBe(0)
        expect(stdout).toContain("Phase 2")
        expect(stdout).toContain("Android Runtime")
        expect(stdout).toContain("Command Matches")
        expect(seen).toContain("GET /session/ses_sidecar/children")
        expect(seen.filter((item) => item === "GET /session/ses_sidecar/message/index").length).toBeGreaterThanOrEqual(
          3,
        )
        expect(seen).toContain("GET /session/status")
        expect(seen).toContain("POST /session/ses_sidecar/share")
        expect(seen).toContain("DELETE /session/ses_sidecar/share")
        expect(seen).toContain("POST /session/ses_sidecar/pause")
        expect(seen).toContain("POST /session/ses_sidecar/resume")
        expect(seen).toContain("POST /session/ses_sidecar/summarize")
        expect(seen).toContain("POST /session/ses_sidecar/abort")
        expect(seen).toContain("POST /session/ses_sidecar/fork")
        expect(seen).toContain("GET /session/ses_fork")
        expect(summaries).toEqual([{ providerID: "openai", modelID: "gpt-5" }])

        expect(shells).toEqual([{ command: "ls -la", model: { providerID: "openai", modelID: "gpt-5" } }])
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("routes sidecar summary and files sidebar actions", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-sidebar-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const bodies: Array<{ parts?: Array<{ type?: string; path?: string; text?: string }> }> = []
      const seen: string[] = []
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url)
          seen.push(`${req.method} ${url.pathname}`)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Sidebar Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname === "/file/status")
            return json([{ path: "src/app.ts", status: "modified", additions: 2, deletions: 1 }])
          if (url.pathname === "/file") return json([{ path: "src/app.ts", name: "app.ts", type: "file" }])
          if (url.pathname === "/file/content") return json({ content: "hello" })
          if (url.pathname === "/editor" && req.method === "POST")
            return json({ id: "edt_sidebar", sessionID: "ses_sidecar", file: "src/app.ts", dirty: false, diff: false })
          if (url.pathname === "/session/ses_sidecar/prompt_async" && req.method === "POST") {
            bodies.push((await req.json()) as { parts?: Array<{ type?: string; path?: string; text?: string }> })
            return new Response(null, { status: 204 })
          }
          if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
          return json({})
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        for (const input of ["/summary\r", "/files\r", "/open src/app.ts\r", "/attach src/app.ts\r", "use it\r"]) {
          proc.stdin.write(input)
          await Bun.sleep(50)
        }
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
        expect(stdout).toContain("hello")
        expect(code).toBe(0)
        expect(stdout).toContain("Sidebar overlay")
        expect(stdout).toContain("Open Files")
        expect(stdout).toContain("[attach]")
        expect(stdout).toContain("[open]")
        expect(seen).toContain("GET /file/status")
        expect(seen).toContain("GET /file")
        expect(seen).toContain("POST /editor")
        expect(bodies[0]?.parts?.map((item) => item.type)).toEqual(["file", "text"])
        expect(bodies[0]?.parts?.[0]?.path).toBe("src/app.ts")
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test("routes sidecar editor, diff, diagnostics, and terminal polish commands", async () => {
    if (process.platform === "win32") return
    const check = Bun.spawn(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-native-host-editor-"))
    try {
      const bin = path.join(dir, "slopcode-android-host")
      const build = Bun.spawn(["rustc", "native/android-host/main.rs", "-O", "-o", bin], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await build.exited).toBe(0)

      const seen: string[] = []
      const editorState = { dirty: true, diff: true, content: "console.log('ok')" }
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
      const port = 38000 + Math.floor(Math.random() * 10000)
      const server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url)
          seen.push(`${req.method} ${url.pathname}`)
          if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_sidecar" })
          if (url.pathname === "/session/ses_sidecar") return json({ id: "ses_sidecar", title: "Editor Session" })
          if (url.pathname === "/session/ses_sidecar/message/index") return json([])
          if (url.pathname === "/session/ses_sidecar/diff/index") return json([{ file: "src/app.ts" }])
          if (url.pathname === "/editor" && req.method === "POST")
            return json({ id: "edt_sidecar", sessionID: "ses_sidecar", file: "src/app.ts", dirty: true, diff: true })
          if (url.pathname === "/editor/edt_sidecar/snapshot")
            return json({
              file: "src/app.ts",
              dirty: editorState.dirty,
              diff: editorState.diff,
              content: editorState.content,
              diagnostics: [{ line: 1, column: 1, severity: "error", message: "expected semicolon" }],
            })
          if (url.pathname === "/editor/edt_sidecar/save" && req.method === "POST") {
            editorState.dirty = false
            return json({ id: "edt_sidecar", sessionID: "ses_sidecar", file: "src/app.ts", dirty: false, diff: true })
          }
          if (url.pathname === "/editor/edt_sidecar/diff/dismiss" && req.method === "POST") {
            editorState.diff = false
            return json({ id: "edt_sidecar", sessionID: "ses_sidecar", file: "src/app.ts", dirty: false, diff: false })
          }
          if (url.pathname === "/editor/edt_sidecar" && req.method === "DELETE") return json(true)
          if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
          return json({})
        },
      })
      try {
        const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        })
        for (const input of [
          "/open src/app.ts\r",
          "/diagnostics\r",
          "/close-editor\r",
          "/save\r",
          "/diff dismiss\r",
          "/close-editor!\r",
          "/keybinds\r",
          "/clipboard\r",
          "/title Android Title\r",
          "/suspend\r",
          "/plugins\r",
        ]) {
          proc.stdin.write(input)
          await Bun.sleep(50)
        }
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
        expect(code).toBe(0)
        expect(stdout).toContain("Editor")
        expect(stdout).toContain("Clipboard")
        expect(stdout).toContain("Plugins")
        expect(seen).toContain("POST /editor")
        expect(seen).toContain("GET /editor/edt_sidecar/snapshot")
        expect(seen).toContain("POST /editor/edt_sidecar/save")
        expect(seen).toContain("POST /editor/edt_sidecar/diff/dismiss")
        expect(seen).toContain("DELETE /editor/edt_sidecar")
      } finally {
        server.stop(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
