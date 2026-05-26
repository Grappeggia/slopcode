import { describe, expect, test } from "bun:test"
import { PassThrough } from "stream"
import {
  applyPortableEvent,
  createPortableState,
  parseModel,
  parseQuestionAnswer,
  parseSseBlock,
  portableTui,
  renderPortableLines,
} from "@/cli/cmd/tui/portable"

describe("portable Termux TUI", () => {
  test("parses models and server-sent events", () => {
    expect(parseModel("anthropic/claude-sonnet-4-5")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-5",
    })
    expect(parseModel("badmodel")).toBeUndefined()
    expect(parseSseBlock('event: message\ndata: {"type":"server.connected","properties":{}}')).toEqual({
      type: "server.connected",
      properties: {},
    })
  })

  test("reduces message, status, permission, and question events", () => {
    const state = createPortableState({ sessionID: "ses_test", model: "test/model" })

    applyPortableEvent(state, { type: "server.connected", properties: {} })
    applyPortableEvent(state, {
      type: "session.updated",
      properties: { info: { id: "ses_test", title: "Test Session" } },
    })
    applyPortableEvent(state, {
      type: "session.status",
      properties: { sessionID: "ses_test", status: { type: "busy", phase: "running", since: 1, updated: 2 } },
    })
    applyPortableEvent(state, {
      type: "message.updated",
      properties: {
        info: { id: "msg_user", sessionID: "ses_test", role: "user", time: { created: 1 } },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: { id: "prt_user", sessionID: "ses_test", messageID: "msg_user", type: "text", text: "hello" },
      },
    })
    applyPortableEvent(state, {
      type: "message.updated",
      properties: {
        info: { id: "msg_assistant", sessionID: "ses_test", role: "assistant", time: { created: 2 } },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: {
          id: "prt_tool",
          sessionID: "ses_test",
          messageID: "msg_assistant",
          type: "tool",
          tool: "bash",
          state: { status: "completed" },
        },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: { id: "prt_text", sessionID: "ses_test", messageID: "msg_assistant", type: "text", text: "hi" },
      },
    })
    applyPortableEvent(state, {
      type: "permission.asked",
      properties: {
        id: "per_test",
        sessionID: "ses_test",
        permission: "edit",
        patterns: ["*"],
      },
    })

    expect(state.connected).toBe(true)
    expect(renderPortableLines(state, 80, 20).join("\n")).toContain("SlopCode Android fallback")
    expect(state.status).toBe("running")
    expect(state.mode).toBe("permission")
    expect(renderPortableLines(state, 80, 20).join("\n")).toContain("Assistant: hi")
    expect(renderPortableLines(state, 80, 20).join("\n")).toContain("tool bash completed")

    applyPortableEvent(state, {
      type: "permission.replied",
      properties: { sessionID: "ses_test", requestID: "per_test", reply: "once" },
    })
    expect(state.mode).toBe("prompt")

    applyPortableEvent(state, {
      type: "question.asked",
      properties: {
        id: "que_test",
        sessionID: "ses_test",
        questions: [
          {
            header: "Choice",
            question: "Pick one",
            options: [{ label: "Yes", description: "accept" }],
          },
        ],
      },
    })
    expect(state.mode).toBe("question")
  })

  test("parses question answers by option number, label, or custom text", () => {
    const info = {
      header: "Mode",
      question: "Select mode",
      multiple: true,
      options: [
        { label: "Build", description: "build" },
        { label: "Plan", description: "plan" },
      ],
    }

    expect(parseQuestionAnswer("1, Plan", info)).toEqual(["Build", "Plan"])
    expect(parseQuestionAnswer("custom", { ...info, multiple: false })).toEqual(["custom"])
    expect(parseQuestionAnswer("custom", { ...info, custom: false })).toEqual([])
  })

  test("creates sessions through /session without a trailing slash", async () => {
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/event") {
          return new Response("", {
            headers: { "content-type": "text/event-stream" },
          })
        }
        if (req.method === "POST" && url.pathname === "/session") {
          return Response.json({ id: "ses_test", title: "Test Session" })
        }
        if (req.method === "GET" && url.pathname === "/session/ses_test") {
          return Response.json({ id: "ses_test", title: "Test Session" })
        }
        if (req.method === "GET" && url.pathname === "/session/ses_test/message/index") {
          return Response.json([])
        }
        return new Response("not found", { status: 404 })
      },
    })
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream

    try {
      const run = portableTui({
        url: `http://127.0.0.1:${server.port}`,
        directory: "/tmp",
        args: {},
        stdin,
        stdout,
      })
      await Bun.sleep(50)
      stdin.push("\x04")
      stdin.push(null)
      await run
      expect(seen).toContain("POST /session")
      expect(seen).not.toContain("POST /session/")
    } finally {
      server.stop(true)
    }
  })

  test("handles multiline paste, cursor editing, and history", async () => {
    const bodies: Array<{ parts?: Array<{ text?: string }> }> = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/event") return new Response("", { headers: { "content-type": "text/event-stream" } })
        if (req.method === "POST" && url.pathname === "/session")
          return Response.json({ id: "ses_test", title: "Test Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test")
          return Response.json({ id: "ses_test", title: "Test Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test/message/index") return Response.json([])
        if (req.method === "POST" && url.pathname === "/session/ses_test/prompt_async") {
          bodies.push((await req.json()) as { parts?: Array<{ text?: string }> })
          return new Response(null, { status: 204 })
        }
        return new Response("not found", { status: 404 })
      },
    })
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream

    try {
      const run = portableTui({
        url: `http://127.0.0.1:${server.port}`,
        directory: "/tmp",
        args: {},
        stdin,
        stdout,
      })
      await Bun.sleep(50)
      stdin.push("\x1b[200~hello\nworld\x1b[201~\r")
      await Bun.sleep(50)
      stdin.push("first\r")
      await Bun.sleep(50)
      stdin.push("\x1b[A again\r")
      await Bun.sleep(50)
      stdin.push("\x04")
      stdin.push(null)
      await run
      expect(bodies.map((item) => item.parts?.[0]?.text)).toEqual(["hello\nworld", "first", "first again"])
    } finally {
      server.stop(true)
    }
  })

  test("handles prompt stash, shell mode, and navigation commands", async () => {
    const seen: string[] = []
    const shells: Array<{ command?: string }> = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/event") return new Response("", { headers: { "content-type": "text/event-stream" } })
        if (req.method === "POST" && url.pathname === "/session")
          return Response.json({ id: "ses_test", title: "Test Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test")
          return Response.json({ id: "ses_test", title: "Test Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test/children")
          return Response.json([{ id: "ses_child", title: "Child" }])
        if (req.method === "GET" && url.pathname === "/session/ses_test/message/index")
          return Response.json([{ id: "msg_test", sessionID: "ses_test", role: "user", time: { created: 1 } }])
        if (req.method === "POST" && url.pathname === "/session/ses_test/message/chunk") return Response.json([])
        if (req.method === "POST" && url.pathname === "/session/ses_test/shell") {
          shells.push((await req.json()) as { command?: string })
          return Response.json({ id: "msg_shell", sessionID: "ses_test", role: "assistant" })
        }
        return new Response("not found", { status: 404 })
      },
    })
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream

    try {
      const run = portableTui({
        url: `http://127.0.0.1:${server.port}`,
        directory: "/tmp",
        args: {},
        stdin,
        stdout,
      })
      await Bun.sleep(50)
      stdin.push("/children\r/messages\r/timeline\rdraft\x1b[24~/list\r\x1b[25~\t\r/shell\rls\r")
      await Bun.sleep(50)
      stdin.push("\x04")
      stdin.push(null)
      await run
      expect(seen).toContain("GET /session/ses_test/children")
      expect(seen.filter((item) => item === "GET /session/ses_test/message/index").length).toBeGreaterThanOrEqual(3)
      expect(shells).toEqual([{ command: "ls" }])
    } finally {
      server.stop(true)
    }
  })

  test("renders summary and files sidebars with attach and open flows", async () => {
    const bodies: Array<{ parts?: Array<{ type?: string; path?: string; text?: string }> }> = []
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/event") return new Response("", { headers: { "content-type": "text/event-stream" } })
        if (req.method === "POST" && url.pathname === "/session")
          return Response.json({ id: "ses_test", title: "Sidebar Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test")
          return Response.json({ id: "ses_test", title: "Sidebar Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test/message/index") return Response.json([])
        if (req.method === "GET" && url.pathname === "/file/status")
          return Response.json([{ path: "src/app.ts", status: "modified", additions: 2, deletions: 1 }])
        if (req.method === "GET" && url.pathname === "/file")
          return Response.json([{ path: "src/app.ts", name: "app.ts", type: "file" }])
        if (req.method === "GET" && url.pathname === "/file/content") return Response.json({ content: "hello" })
        if (req.method === "POST" && url.pathname === "/session/ses_test/prompt_async") {
          bodies.push((await req.json()) as { parts?: Array<{ type?: string; path?: string; text?: string }> })
          return new Response(null, { status: 204 })
        }
        return new Response("not found", { status: 404 })
      },
    })
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream & { columns?: number; rows?: number }
    stdout.columns = 44
    stdout.rows = 18
    const chunks: string[] = []
    stdout.write = ((chunk: unknown) => {
      chunks.push(String(chunk))
      return true
    }) as typeof stdout.write

    try {
      const run = portableTui({
        url: `http://127.0.0.1:${server.port}`,
        directory: "/tmp",
        args: {},
        stdin,
        stdout,
      })
      await Bun.sleep(50)
      stdin.push("/summary\r/files\r/open src/app.ts\r/attach src/app.ts\ruse it\r")
      await Bun.sleep(100)
      stdin.push("\x04")
      stdin.push(null)
      await run
      const output = chunks.join("\n")
      expect(output).toContain("Sidebar overlay")
      expect(output).toContain("Summary")
      expect(output).toContain("Files")
      expect(output).toContain("Open Files")
      expect(output).toContain("[attach]")
      expect(output).toContain("[open]")
      expect(seen).toContain("GET /file/status")
      expect(seen).toContain("GET /file")
      expect(seen).toContain("GET /file/content")
      expect(bodies[0]?.parts?.map((item) => item.type)).toEqual(["file", "text"])
      expect(bodies[0]?.parts?.[0]?.path).toBe("src/app.ts")
    } finally {
      server.stop(true)
    }
  })

  test("renders tool cards, clipped markdown code, diffs, and grouped permissions", () => {
    const state = createPortableState({ sessionID: "ses_test" })
    state.sessions.set("ses_test", { id: "ses_test", title: "Render Session" })
    applyPortableEvent(state, {
      type: "message.updated",
      properties: { info: { id: "msg_assistant", sessionID: "ses_test", role: "assistant", time: { created: 1 } } },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: {
          id: "prt_text",
          sessionID: "ses_test",
          messageID: "msg_assistant",
          type: "text",
          text: [
            "Here is code",
            "```ts",
            ...Array.from({ length: 20 }, (_, index) => `const value${index} = \"${"x".repeat(80)}\"`),
            "```",
          ].join("\n"),
        },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: {
          id: "prt_tool",
          sessionID: "ses_test",
          messageID: "msg_assistant",
          type: "tool",
          tool: "edit",
          state: {
            status: "completed",
            input: { filePath: "src/app.ts", diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new" },
            output: Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n"),
          },
        },
      },
    })
    applyPortableEvent(state, {
      type: "permission.asked",
      properties: {
        id: "per_one",
        sessionID: "ses_test",
        permission: "edit",
        patterns: ["src/app.ts"],
        reason: "change file",
        metadata: { forecast: true, childSessionID: "ses_child" },
      },
    })
    applyPortableEvent(state, {
      type: "permission.asked",
      properties: {
        id: "per_two",
        sessionID: "ses_test",
        permission: "bash",
        patterns: ["bun test"],
        source: "worker",
      },
    })

    const output = renderPortableLines(state, 100, 80).join("\n")
    expect(output).toContain("tool edit completed [expanded]")
    expect(output).toContain("diff preview")
    expect(output).toContain("+new")
    expect(output).toContain("... 12 more line(s)")
    expect(output).toContain("... 8 more code line(s)")
    expect(output).toContain("permission 1/2: edit source child ses_child forecast")
    expect(output).toContain("grouped: edit x1, bash x1")
    expect(output).toContain("r reject, n/p request")
  })

  test("sends custom permission reject reasons", async () => {
    const replies: Array<{ reply?: string; reason?: string }> = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/event") {
          return new Response(
            [
              'data: {"type":"permission.asked","properties":{"id":"per_one","sessionID":"ses_test","permission":"edit","patterns":["src/app.ts"]}}',
              "",
            ].join("\n\n"),
            { headers: { "content-type": "text/event-stream" } },
          )
        }
        if (req.method === "POST" && url.pathname === "/session")
          return Response.json({ id: "ses_test", title: "Permission Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test")
          return Response.json({ id: "ses_test", title: "Permission Session" })
        if (req.method === "GET" && url.pathname === "/session/ses_test/message/index") return Response.json([])
        if (req.method === "POST" && url.pathname === "/permission/per_one/reply") {
          replies.push((await req.json()) as { reply?: string; reason?: string })
          return Response.json(true)
        }
        return Response.json({})
      },
    })
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream
    try {
      const run = portableTui({
        url: `http://127.0.0.1:${server.port}`,
        directory: "/tmp",
        args: {},
        stdin,
        stdout,
      })
      await Bun.sleep(100)
      stdin.push("rneeds context\r")
      await Bun.sleep(100)
      stdin.push("\x04")
      stdin.push(null)
      await run
      expect(replies).toEqual([{ reply: "reject", reason: "needs context" }])
    } finally {
      server.stop(true)
    }
  })

  test("renders docked sidebar on wide terminals", () => {
    const state = createPortableState({ sessionID: "ses_test" })
    state.sessions.set("ses_test", { id: "ses_test", title: "Wide" })
    state.sidebar.visible = true
    state.sidebar.mode = "summary"
    state.sidebar.modified = [{ path: "src/app.ts", status: "modified" }]
    const wide = renderPortableLines(state, 120, 16).join("\n")
    const narrow = renderPortableLines(state, 44, 16).join("\n")
    expect(wide).toContain("Sidebar docked")
    expect(narrow).toContain("Sidebar overlay")
    expect(wide).toContain("Modified Files")
    expect(wide).toContain("src/app.ts [open]")
  })
})
