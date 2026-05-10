import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const dialogPath = path.resolve(pkgDir, "src/cli/cmd/tui/ui/dialog.tsx")
const toastPath = path.resolve(pkgDir, "src/cli/cmd/tui/ui/toast.tsx")
const kvPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/kv.tsx")
const tuiConfigPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/tui-config.tsx")
const themePath = path.resolve(pkgDir, "src/cli/cmd/tui/context/theme.tsx")
const keybindPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/keybind.tsx")
const promptPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/prompt.tsx")
const commandPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/dialog-command.tsx")
const scripts: string[] = []

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
})

async function script() {
  const file = path.join(
    pkgDir,
    `.tmp-dialog-owner-context-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tsx`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { render, useTerminalDimensions } from "@opentui/solid"
import { onMount } from "solid-js"
import { KVProvider } from ${JSON.stringify(kvPath)}
import { TuiConfigProvider } from ${JSON.stringify(tuiConfigPath)}
import { ThemeProvider } from ${JSON.stringify(themePath)}
import { KeybindProvider } from ${JSON.stringify(keybindPath)}
import { ToastProvider } from ${JSON.stringify(toastPath)}
import { DialogProvider, useDialog } from ${JSON.stringify(dialogPath)}
import { CommandDialogBridge, CommandProvider, useCommandDialog } from ${JSON.stringify(commandPath)}
import { PromptRefProvider, usePromptRef } from ${JSON.stringify(promptPath)}

const fail = setTimeout(() => process.exit(2), 3000)

function DialogProbe() {
  const promptRef = usePromptRef()
  const command = useCommandDialog()

  onMount(() => {
    promptRef.set(undefined)
    command.keybinds(true)
    clearTimeout(fail)
    setTimeout(() => process.exit(0), 100)
  })

  return <text>dialog-ready</text>
}

function App() {
  const dialog = useDialog()
  const dims = useTerminalDimensions()

  onMount(() => {
    dialog.replace(() => <DialogProbe />)
  })

  return <box width={dims().width} height={dims().height} />
}

render(
  () => (
    <KVProvider>
      <ToastProvider>
        <TuiConfigProvider config={{}}>
          <ThemeProvider mode="dark">
            <KeybindProvider>
              <PromptRefProvider>
                <CommandProvider>
                  <DialogProvider>
                    <CommandDialogBridge />
                    <App />
                  </DialogProvider>
                </CommandProvider>
              </PromptRefProvider>
            </KeybindProvider>
          </ThemeProvider>
        </TuiConfigProvider>
      </ToastProvider>
    </KVProvider>
  ),
  {
    targetFps: 60,
    gatherStats: false,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
  },
)
`,
  )
  return file
}

async function run() {
  const file = await script()
  const home = path.join(
    os.tmpdir(),
    `slopcode-dialog-owner-context-home-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await fs.mkdir(home, { recursive: true })
  const child = Bun.spawn([process.execPath, "--cwd", pkgDir, file], {
    cwd: pkgDir,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      COLUMNS: "84",
      LINES: "24",
      TERM: "xterm-256color",
      SLOPCODE_TEST_HOME: home,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const exited = child.exited
  const stdout = child.stdout ? new Response(child.stdout).text() : Promise.resolve("")
  const stderr = child.stderr ? new Response(child.stderr).text() : Promise.resolve("")
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      child.kill()
      reject(new Error("probe timed out"))
    }, 10_000)
  })
  const code = await Promise.race([exited, timeout])
  if (timer) clearTimeout(timer)
  const raw = await stdout
  const err = await stderr
  await fs.rm(home, { recursive: true, force: true })
  return {
    code,
    raw,
    err,
  }
}

describe("dialog owner context", () => {
  test("preserves prompt and command contexts for deferred dialogs", async () => {
    const result = await run()

    expect(result.code).toBe(0)
    expect(result.err).not.toContain("context must be used within a context provider")
  }, 15_000)
})
