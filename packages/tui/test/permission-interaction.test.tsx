/** @jsxImportSource @opentui/solid */
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { createSignal, onCleanup, type JSX } from "solid-js"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { tmpdir } from "./fixture/fixture"
import { createEventSource, createFetch, json } from "./fixture/tui-sdk"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"
import { TestTuiContexts } from "./fixture/tui-environment"
import { ArgsProvider } from "../src/context/args"
import { TuiConfigProvider } from "../src/config"
import { ExitProvider } from "../src/context/exit"
import { KVProvider } from "../src/context/kv"
import { PathFormatterProvider } from "../src/context/path-format"
import { PermissionProvider } from "../src/context/permission"
import { ProjectProvider } from "../src/context/project"
import { SDKProvider } from "../src/context/sdk"
import { SyncProvider } from "../src/context/sync"
import { ThemeProvider } from "../src/context/theme"
import { SlopcodeKeymapProvider, registerSlopcodeKeymap } from "../src/keymap"
import { DialogProvider } from "../src/ui/dialog"
import { DialogSelect } from "../src/ui/dialog-select"
import { ToastProvider } from "../src/ui/toast"
import { PermissionPrompt, Prompt } from "../src/routes/session/permission"

async function mount(root: string, content: () => JSX.Element) {
  const state = path.join(root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const config = createTuiResolvedConfig()
    onCleanup(registerSlopcodeKeymap(keymap, renderer, config))

    return (
      <TestTuiContexts directory={root} paths={{ home: root, state, worktree: root }}>
        <SlopcodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <KVProvider>
              <ThemeProvider mode="dark">
                <ToastProvider>
                  <DialogProvider>{content()}</DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </KVProvider>
          </TuiConfigProvider>
        </SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  return testRender(() => <Harness />, { width: 140, height: 20, kittyKeyboard: true })
}

async function waitFor(app: Awaited<ReturnType<typeof testRender>>, text: string) {
  const start = Date.now()
  while (Date.now() - start < 2_000) {
    await app.renderOnce()
    if (app.captureCharFrame().includes(text)) return
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${text}`)
}

function request(id: string): PermissionRequest {
  return {
    id,
    sessionID: "ses_test",
    permission: "bash",
    patterns: ["git status"],
    metadata: { command: "git status" },
    always: ["git status"],
  }
}

test("permission Prompt reacts to available batch actions and normalizes selection", async () => {
  await using tmp = await tmpdir()
  const [options, setOptions] = createSignal<Record<string, string>>({
    once: "Allow selected once",
    reject: "Reject all",
  })
  const selected: string[] = []
  const app = await mount(tmp.path, () => (
    <Prompt
      title="Review build permissions"
      body={<box />}
      options={options()}
      escapeKey="reject"
      onSelect={(option) => selected.push(String(option))}
    />
  ))

  try {
    await waitFor(app, "Review build permissions")
    expect(app.captureCharFrame()).not.toContain("Allow selected for this session")

    setOptions({
      once: "Allow selected once",
      always: "Allow selected for this session",
      project: "Always allow selected for this project",
      reject: "Reject all",
    })
    await waitFor(app, "Allow selected for this session")
    expect(app.captureCharFrame()).toContain("Allow selected for this session")
    expect(app.captureCharFrame()).toContain("Always allow selected for this project")

    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressKey("ARROW_RIGHT")
    setOptions({ once: "Allow selected once", reject: "Reject all" })
    await waitFor(app, "Reject all")
    expect(app.captureCharFrame()).not.toContain("Always allow selected for this project")
    app.mockInput.pressEnter()
    expect(selected).toEqual(["once"])
  } finally {
    app.renderer.destroy()
  }
})

test("permission management refresh runs with an empty successful list", async () => {
  await using tmp = await tmpdir()
  let refreshed = 0
  const app = await mount(tmp.path, () => (
    <DialogSelect
      title="Permissions for this folder"
      options={[]}
      actions={[
        {
          command: "dialog.permission.refresh",
          title: "refresh",
          requiresSelection: false,
          onTrigger: () => {
            refreshed += 1
          },
        },
      ]}
    />
  ))

  try {
    await waitFor(app, "Permissions for this folder")
    app.mockInput.pressKey("r", { ctrl: true })
    expect(refreshed).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})

test("single permission replacement closes durable confirmation", async () => {
  await using tmp = await tmpdir()
  const state = path.join(tmp.path, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")
  const events = createEventSource()
  const replies: Array<{ id: string; reply: string }> = []
  const calls = createFetch(async (url, request) => {
    if (url.pathname === "/project/current")
      return json({ id: "proj_test", worktree: tmp.path, vcs: "git" })
    if (url.pathname === "/project/proj_test/directories") return json([{ directory: tmp.path }])
    const match = url.pathname.match(/^\/permission\/(.+)\/reply$/)
    if (!match || !request) return undefined
    replies.push({ id: match[1]!, reply: String((await request.json()).reply) })
    return json(true)
  })
  const [requests, setRequests] = createSignal([request("per_first")])

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const config = createTuiResolvedConfig()
    onCleanup(registerSlopcodeKeymap(keymap, renderer, config))
    return (
      <SlopcodeKeymapProvider keymap={keymap}>
        <TuiConfigProvider config={config}>
          <ThemeProvider mode="dark">
            <PathFormatterProvider location={undefined}>
              <PermissionPrompt requests={requests()} directory={tmp.path} />
            </PathFormatterProvider>
          </ThemeProvider>
        </TuiConfigProvider>
      </SlopcodeKeymapProvider>
    )
  }

  const app = await testRender(
    () => (
      <TestTuiContexts directory={tmp.path} paths={{ home: tmp.path, state, worktree: tmp.path }}>
        <ArgsProvider>
          <KVProvider>
            <ToastProvider>
              <SDKProvider url="http://test" directory={tmp.path} fetch={calls.fetch} events={events.source}>
                <ProjectProvider>
                  <ExitProvider exit={() => {}}>
                    <PermissionProvider>
                      <SyncProvider>
                        <Harness />
                      </SyncProvider>
                    </PermissionProvider>
                  </ExitProvider>
                </ProjectProvider>
              </SDKProvider>
            </ToastProvider>
          </KVProvider>
        </ArgsProvider>
      </TestTuiContexts>
    ),
    { width: 140, height: 20, kittyKeyboard: true },
  )

  try {
    await waitFor(app, "Always allow for this project")
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressEnter()
    await waitFor(app, "survives restarts")

    setRequests([request("per_second")])
    await waitFor(app, "Permission required")
    expect(app.captureCharFrame()).not.toContain("survives restarts")
    app.mockInput.pressEnter()
    for (let i = 0; i < 100 && replies.length === 0; i++) await Bun.sleep(10)

    expect(replies).toEqual([{ id: "per_second", reply: "once" }])
  } finally {
    app.renderer.destroy()
  }
})
