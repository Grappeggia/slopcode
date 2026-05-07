import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, ErrorBoundary, Match, on, onMount, Switch } from "solid-js"
import { Clipboard } from "@tui/util/clipboard"
import { Selection } from "@tui/util/selection"
import { MouseButton, TextAttributes } from "@opentui/core"
import { RouteProvider, useRoute } from "@tui/context/route"
import { SessionTabsProvider, useSessionTabs } from "@tui/context/session-tabs"
import { TabStateProvider, useTabState } from "@tui/context/tab-state"
import { EditorConnectionProvider } from "@tui/context/editor-connection"
import { EditorContextProvider, useEditorContext } from "@tui/context/editor"
import { SDKProvider, useSDK } from "@tui/context/sdk"
import { SyncProvider, useSync } from "@tui/context/sync"
import { DialogProvider, useDialog } from "@tui/ui/dialog"

import { LocalProvider, useLocal } from "@tui/context/local"
import { DialogModel, useConnected } from "@tui/component/dialog-model"
import { DialogModelCompletion } from "@tui/component/dialog-model-completion"
import { DialogMcp } from "@tui/component/dialog-mcp"
import { DialogVariant } from "@tui/component/dialog-variant"
import { DialogStatus } from "@tui/component/dialog-status"
import { DialogThemeList } from "@tui/component/dialog-theme-list"
import { DialogHelp } from "./ui/dialog-help"
import { CommandProvider, useCommandDialog } from "@tui/component/dialog-command"
import { DialogAgent } from "@tui/component/dialog-agent"
import { DialogProvider as DialogProviderList } from "@tui/component/dialog-provider"
import { DialogShell } from "@tui/component/dialog-shell"
import { DialogSessionList } from "@tui/component/dialog-session-list"
import { DialogWorkspaceList } from "@tui/component/dialog-workspace-list"
import { DialogConsoleOrg } from "@tui/component/dialog-console-org"
import { KeybindProvider, useKeybind } from "@tui/context/keybind"
import { ThemeProvider, useTheme } from "@tui/context/theme"
import { Home } from "@tui/routes/home"
import { Session } from "@tui/routes/session"
import { PromptHistoryProvider } from "./component/prompt/history"
import { FrecencyProvider } from "./component/prompt/frecency"
import { PromptStashProvider } from "./component/prompt/stash"

import { ToastProvider, useToast } from "./ui/toast"
import { ExitProvider, useExit } from "./context/exit"
import { Session as SessionApi } from "@/session"
import { TuiEvent } from "./event"
import { KVProvider, useKV } from "./context/kv"
import { Provider } from "@/provider/provider"
import { ArgsProvider, useArgs, type Args } from "./context/args"
import { writeHeapSnapshot } from "v8"
import { PromptRefProvider, usePromptRef } from "./context/prompt"
import { TuiConfigProvider, useTuiConfig } from "./context/tui-config"
import { TuiConfig } from "@/config/tui"
import { Flag } from "@/flag/flag"
import { Installation } from "@/installation"
import { win32DisableProcessedInput, win32FlushInputBuffer, win32InstallCtrlCGuard } from "./win32"
import { DRAFT_TAB_ID } from "./context/session-tabs-state"
import { createTuiApi, type RouteMap } from "./plugin/api"
import { TuiPluginRuntime } from "./plugin/runtime"

async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // can't set raw mode if not a TTY
  if (!process.stdin.isTTY) return "dark"

  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", handler)
      clearTimeout(timeout)
    }

    const handler = (data: Buffer) => {
      const str = data.toString()
      const match = str.match(/\x1b]11;([^\x07\x1b]+)/)
      if (match) {
        cleanup()
        const color = match[1]
        // Parse RGB values from color string
        // Formats: rgb:RR/GG/BB or #RRGGBB or rgb(R,G,B)
        let r = 0,
          g = 0,
          b = 0

        if (color.startsWith("rgb:")) {
          const parts = color.substring(4).split("/")
          r = parseInt(parts[0], 16) >> 8 // Convert 16-bit to 8-bit
          g = parseInt(parts[1], 16) >> 8 // Convert 16-bit to 8-bit
          b = parseInt(parts[2], 16) >> 8 // Convert 16-bit to 8-bit
        } else if (color.startsWith("#")) {
          r = parseInt(color.substring(1, 3), 16)
          g = parseInt(color.substring(3, 5), 16)
          b = parseInt(color.substring(5, 7), 16)
        } else if (color.startsWith("rgb(")) {
          const parts = color.substring(4, color.length - 1).split(",")
          r = parseInt(parts[0])
          g = parseInt(parts[1])
          b = parseInt(parts[2])
        }

        // Calculate luminance using relative luminance formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // Determine if dark or light based on luminance threshold
        resolve(luminance > 0.5 ? "light" : "dark")
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.on("data", handler)
    process.stdout.write("\x1b]11;?\x07")

    timeout = setTimeout(() => {
      cleanup()
      resolve("dark")
    }, 1000)
  })
}

import type { EventSource } from "./context/sdk"

function rendererConfig(config: TuiConfig.Info) {
  return {
    targetFps: 60,
    gatherStats: false,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
    autoFocus: false,
    openConsoleOnError: false,
    useMouse: !Flag.SLOPCODE_DISABLE_MOUSE && (config.mouse ?? true),
    consoleOptions: {
      keyBindings: [{ name: "y", ctrl: true, action: "copy-selection" as const }],
      onCopySelection: (text: string) => {
        Clipboard.copy(text).catch((error) => {
          console.error(`Failed to copy console selection to clipboard: ${error}`)
        })
      },
    },
  }
}

export function tui(input: {
  url: string
  args: Args
  config: TuiConfig.Info
  directory?: string
  viewID?: string
  fetch?: typeof fetch
  headers?: RequestInit["headers"]
  events?: EventSource
  onExit?: () => Promise<void>
}) {
  // promise to prevent immediate exit
  return new Promise<void>(async (resolve) => {
    const unguard = win32InstallCtrlCGuard()
    win32DisableProcessedInput()

    const mode = await getTerminalBackgroundColor()

    // Re-clear after getTerminalBackgroundColor() — setRawMode(false) restores
    // the original console mode which re-enables ENABLE_PROCESSED_INPUT.
    win32DisableProcessedInput()

    const onExit = async () => {
      await TuiPluginRuntime.dispose().catch((error) => console.error("Failed to dispose TUI plugins", error))
      unguard?.()
      await input.onExit?.()
      resolve()
    }

    render(() => {
      return (
        <ErrorBoundary
          fallback={(error, reset) => <ErrorComponent error={error} reset={reset} onExit={onExit} mode={mode} />}
        >
          <ArgsProvider {...input.args}>
            <ExitProvider onExit={onExit}>
              <KVProvider>
                <ToastProvider>
                  <RouteProvider>
                    <TuiConfigProvider config={input.config}>
                      <SDKProvider
                        url={input.url}
                        directory={input.directory}
                        viewID={input.viewID}
                        fetch={input.fetch}
                        headers={input.headers}
                        events={input.events}
                      >
                        <SyncProvider>
                          <SessionTabsProvider>
                            <TabStateProvider>
                              <EditorConnectionProvider>
                                <EditorContextProvider>
                                  <ThemeProvider mode={mode}>
                                    <LocalProvider>
                                      <KeybindProvider>
                                        <PromptStashProvider>
                                          <DialogProvider>
                                            <CommandProvider>
                                              <FrecencyProvider>
                                                <PromptHistoryProvider>
                                                  <PromptRefProvider>
                                                    <App />
                                                  </PromptRefProvider>
                                                </PromptHistoryProvider>
                                              </FrecencyProvider>
                                            </CommandProvider>
                                          </DialogProvider>
                                        </PromptStashProvider>
                                      </KeybindProvider>
                                    </LocalProvider>
                                  </ThemeProvider>
                                </EditorContextProvider>
                              </EditorConnectionProvider>
                            </TabStateProvider>
                          </SessionTabsProvider>
                        </SyncProvider>
                      </SDKProvider>
                    </TuiConfigProvider>
                  </RouteProvider>
                </ToastProvider>
              </KVProvider>
            </ExitProvider>
          </ArgsProvider>
        </ErrorBoundary>
      )
    }, rendererConfig(input.config))
  })
}

function App() {
  const tuiConfig = useTuiConfig()
  const route = useRoute()
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  renderer.disableStdoutInterception()
  const dialog = useDialog()
  const local = useLocal()
  const kv = useKV()
  const command = useCommandDialog()
  const keybind = useKeybind()
  const sdk = useSDK()
  const editor = useEditorContext()
  const toast = useToast()
  const themeState = useTheme()
  const { theme, mode, setMode } = themeState
  const sync = useSync()
  const exit = useExit()
  const promptRef = usePromptRef()
  const tabs = useSessionTabs()
  const tabState = useTabState()
  const routes: RouteMap = new Map()
  const [routeRev, setRouteRev] = createSignal(0)
  const routeView = (name: string) => {
    routeRev()
    return routes.get(name)?.at(-1)?.render
  }

  const api = createTuiApi({
    command,
    tuiConfig,
    dialog,
    keybind,
    kv,
    route,
    routes,
    bump: () => setRouteRev((value) => value + 1),
    event: sdk.event,
    sdk,
    sync,
    theme: themeState,
    toast,
    renderer,
  })
  const [pluginsReady, setPluginsReady] = createSignal(false)
  TuiPluginRuntime.init({
    api,
    config: tuiConfig,
  })
    .catch((error) => console.error("Failed to load TUI plugins", error))
    .finally(() => setPluginsReady(true))

  useKeyboard((evt) => {
    if (!Flag.SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT) return
    if (!renderer.getSelection()) return

    // Windows Terminal-like behavior:
    // - Ctrl+C copies and dismisses selection
    // - Esc dismisses selection
    // - Most other key input dismisses selection and is passed through
    if (evt.ctrl && evt.name === "c") {
      if (!Selection.copy(renderer, toast)) {
        renderer.clearSelection()
        return
      }

      evt.preventDefault()
      evt.stopPropagation()
      return
    }

    if (evt.name === "escape") {
      renderer.clearSelection()
      evt.preventDefault()
      evt.stopPropagation()
      return
    }

    renderer.clearSelection()
  })

  // Wire up console copy-to-clipboard via opentui's onCopySelection callback
  renderer.console.onCopySelection = async (text: string) => {
    if (!text || text.length === 0) return

    await Clipboard.copy(text)
      .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
      .catch(toast.error)

    renderer.clearSelection()
  }
  const [terminalTitleEnabled, setTerminalTitleEnabled] = createSignal(kv.get("terminal_title_enabled", true))

  // Update terminal window title based on current route and session
  createEffect(() => {
    if (!terminalTitleEnabled() || Flag.SLOPCODE_DISABLE_TERMINAL_TITLE) return

    if (route.data.type === "home") {
      renderer.setTerminalTitle("SlopCode")
      return
    }

    if (route.data.type === "session") {
      const session = sync.session.get(route.data.sessionID)
      if (!session || SessionApi.isDefaultTitle(session.title)) {
        renderer.setTerminalTitle("SlopCode")
        return
      }

      // Truncate title to 40 chars max
      const title = session.title.length > 40 ? session.title.slice(0, 37) + "..." : session.title
      renderer.setTerminalTitle(`SC | ${title}`)
    }
  })

  createEffect(() => {
    editor.reconnect(sync.data.path.directory || sdk.directory || process.cwd())
  })

  const args = useArgs()
  onMount(() => {
    if (args.sessionID && !args.fork) {
      route.navigate({
        type: "session",
        sessionID: args.sessionID,
        source: "switch",
        workspaceID: route.data.workspaceID,
      })
    }
    if (args.agent) local.agent.set(args.agent)
    if (args.model) {
      const { providerID, modelID } = Provider.parseModel(args.model)
      if (!providerID || !modelID)
        return toast.show({
          variant: "warning",
          message: `Invalid model format: ${args.model}`,
          duration: 3000,
        })
      local.model.set({ providerID, modelID }, { recent: true })
    }
  })

  let continued = false
  createEffect(() => {
    // When using -c, session list is loaded in blocking phase, so we can navigate at "partial"
    if (continued || sync.status === "loading" || !args.continue) return
    const match = sync.data.session
      .toSorted((a, b) => b.time.updated - a.time.updated)
      .find((x) => x.parentID === undefined)
    if (match) {
      continued = true
      if (args.fork) {
        sdk.client.session.fork({ sessionID: match.id }).then((result) => {
          if (result.data?.id) {
            route.navigate({
              type: "session",
              sessionID: result.data.id,
              source: "fork",
              workspaceID: (match as { workspaceID?: string }).workspaceID,
            })
          } else {
            toast.show({ message: "Failed to fork session", variant: "error" })
          }
        })
      } else {
        route.navigate({
          type: "session",
          sessionID: match.id,
          source: "switch",
          workspaceID: (match as { workspaceID?: string }).workspaceID,
        })
      }
    }
  })

  // Handle --session with --fork: wait for sync to be fully complete before forking
  // (session list loads in non-blocking phase for --session, so we must wait for "complete"
  // to avoid a race where reconcile overwrites the newly forked session)
  let forked = false
  createEffect(() => {
    if (forked || sync.status !== "complete" || !args.sessionID || !args.fork) return
    forked = true
    sdk.client.session.fork({ sessionID: args.sessionID }).then((result) => {
      if (result.data?.id) {
        route.navigate({
          type: "session",
          sessionID: result.data.id,
          source: "fork",
          workspaceID: route.data.workspaceID,
        })
      } else {
        toast.show({ message: "Failed to fork session", variant: "error" })
      }
    })
  })

  createEffect(
    on(
      () => sync.status === "complete" && sync.data.provider.length === 0,
      (isEmpty, wasEmpty) => {
        // only trigger when we transition into an empty-provider state
        if (!isEmpty || wasEmpty) return
        dialog.replace(() => <DialogProviderList />)
      },
    ),
  )

  const connected = useConnected()
  command.register(() => [
    {
      title: "Switch session",
      value: "session.list",
      keybind: "session_list",
      category: "Session",
      suggested: sync.data.session.length > 0,
      slash: {
        name: "sessions",
        aliases: ["resume", "continue"],
      },
      onSelect: () => {
        dialog.replace(() => <DialogSessionList />)
      },
    },
    {
      title: "Workspaces",
      value: "workspace.list",
      category: "Session",
      slash: {
        name: "workspaces",
        aliases: ["workspace"],
      },
      onSelect: () => {
        dialog.replace(() => <DialogWorkspaceList />)
      },
    },
    {
      title: "New session",
      suggested: route.data.type === "session",
      value: "session.new",
      keybind: "session_new",
      category: "Session",
      slash: {
        name: "new",
        aliases: ["clear"],
      },
      onSelect: () => {
        const current = promptRef.current?.current
        const currentPrompt = current && (current.input || current.parts.length > 0) ? current : undefined
        tabState.copySelection(tabState.currentID(), DRAFT_TAB_ID)
        if (currentPrompt) tabState.setPrompt(DRAFT_TAB_ID, currentPrompt)
        else tabState.clearPrompt(DRAFT_TAB_ID)
        tabs.openDraft()
        dialog.clear()
      },
    },
    {
      title: "Switch model",
      value: "model.list",
      keybind: "model_list",
      suggested: true,
      category: "Agent",
      slash: {
        name: "models",
      },
      onSelect: () => {
        dialog.replace(() => <DialogModel />)
      },
    },
    {
      title: "Autocomplete model overrides",
      value: "model.completion.list",
      category: "Agent",
      slash: {
        name: "models-completion",
      },
      onSelect: () => {
        dialog.replace(() => <DialogModelCompletion />)
      },
    },
    {
      title: "Model cycle",
      value: "model.cycle_recent",
      keybind: "model_cycle_recent",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycle(1)
      },
    },
    {
      title: "Model cycle reverse",
      value: "model.cycle_recent_reverse",
      keybind: "model_cycle_recent_reverse",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycle(-1)
      },
    },
    {
      title: "Favorite cycle",
      value: "model.cycle_favorite",
      keybind: "model_cycle_favorite",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycleFavorite(1)
      },
    },
    {
      title: "Favorite cycle reverse",
      value: "model.cycle_favorite_reverse",
      keybind: "model_cycle_favorite_reverse",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycleFavorite(-1)
      },
    },
    {
      title: "Switch agent",
      value: "agent.list",
      keybind: "agent_list",
      category: "Agent",
      slash: {
        name: "agents",
      },
      onSelect: () => {
        dialog.replace(() => <DialogAgent />)
      },
    },
    {
      title: "Toggle MCPs",
      value: "mcp.list",
      search: "toggle mcps",
      category: "Agent",
      slash: {
        name: "mcps",
      },
      onSelect: () => {
        dialog.replace(() => <DialogMcp />)
      },
    },
    {
      title: "Agent cycle",
      value: "agent.cycle",
      keybind: "agent_cycle",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.agent.move(1)
      },
    },
    {
      title: "Variant cycle",
      value: "variant.cycle",
      keybind: "variant_cycle",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.variant.cycle()
      },
    },
    {
      title: "Switch model variant",
      value: "variant.list",
      keybind: "variant_list",
      category: "Agent",
      hidden: local.model.variant.list().length === 0,
      slash: {
        name: "variants",
      },
      onSelect: () => {
        dialog.replace(() => <DialogVariant />)
      },
    },
    {
      title: "Agent cycle reverse",
      value: "agent.cycle.reverse",
      keybind: "agent_cycle_reverse",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.agent.move(-1)
      },
    },
    {
      title: "Connect provider",
      value: "provider.connect",
      suggested: !connected(),
      slash: {
        name: "connect",
      },
      onSelect: () => {
        dialog.replace(() => <DialogProviderList />)
      },
      category: "Provider",
    },
    {
      title: "Switch console org",
      value: "console.orgs",
      slash: {
        name: "orgs",
        aliases: ["console"],
      },
      onSelect: () => {
        dialog.replace(() => <DialogConsoleOrg />)
      },
      category: "Provider",
    },
    {
      title: "View status",
      keybind: "status_view",
      value: "slopcode.status",
      slash: {
        name: "status",
      },
      onSelect: () => {
        dialog.replace(() => <DialogStatus />)
      },
      category: "System",
    },
    {
      title: "Switch shell",
      value: "shell.list",
      search: "select default shell",
      slash: {
        name: "shells",
        aliases: ["shell"],
      },
      onSelect: () => {
        dialog.replace(() => <DialogShell />)
      },
      category: "System",
    },
    {
      title: "Switch theme",
      value: "theme.switch",
      keybind: "theme_list",
      slash: {
        name: "themes",
      },
      onSelect: () => {
        dialog.replace(() => <DialogThemeList />)
      },
      category: "System",
    },
    {
      title: mode() === "dark" ? "Light mode" : "Dark mode",
      value: "theme.switch_mode",
      search: "toggle appearance",
      onSelect: (dialog) => {
        setMode(mode() === "dark" ? "light" : "dark")
        dialog.clear()
      },
      category: "System",
    },
    {
      title: "Help",
      value: "help.show",
      slash: {
        name: "help",
      },
      onSelect: () => {
        dialog.replace(() => <DialogHelp />)
      },
      category: "System",
    },
    {
      title: "Exit the app",
      value: "app.exit",
      slash: {
        name: "exit",
        aliases: ["quit", "q"],
      },
      onSelect: () => exit(),
      category: "System",
    },
    {
      title: "Toggle debug panel",
      search: "toggle debug",
      category: "System",
      value: "app.debug",
      onSelect: (dialog) => {
        renderer.toggleDebugOverlay()
        dialog.clear()
      },
    },
    {
      title: "Toggle console",
      search: "toggle console",
      category: "System",
      value: "app.console",
      onSelect: (dialog) => {
        renderer.console.toggle()
        dialog.clear()
      },
    },
    {
      title: "Write heap snapshot",
      category: "System",
      value: "app.heap_snapshot",
      onSelect: (dialog) => {
        const path = writeHeapSnapshot()
        toast.show({
          variant: "info",
          message: `Heap snapshot written to ${path}`,
          duration: 5000,
        })
        dialog.clear()
      },
    },
    {
      title: "Suspend terminal",
      value: "terminal.suspend",
      keybind: "terminal_suspend",
      category: "System",
      hidden: true,
      onSelect: () => {
        process.once("SIGCONT", () => {
          renderer.resume()
        })

        renderer.suspend()
        // pid=0 means send the signal to all processes in the process group
        process.kill(0, "SIGTSTP")
      },
    },
    {
      title: terminalTitleEnabled() ? "Disable terminal title" : "Enable terminal title",
      value: "terminal.title.toggle",
      search: "toggle terminal title",
      keybind: "terminal_title_toggle",
      category: "System",
      onSelect: (dialog) => {
        setTerminalTitleEnabled((prev) => {
          const next = !prev
          kv.set("terminal_title_enabled", next)
          if (!next) renderer.setTerminalTitle("")
          return next
        })
        dialog.clear()
      },
    },
    {
      title: kv.get("session_directory_filter_enabled", true)
        ? "Disable session directory filtering"
        : "Enable session directory filtering",
      value: "app.toggle.session_directory_filter",
      search: "toggle session filtering",
      category: "System",
      onSelect: async (dialog) => {
        kv.set("session_directory_filter_enabled", !kv.get("session_directory_filter_enabled", true))
        await sync.session.refresh()
        dialog.clear()
      },
    },
    {
      title: kv.get("paste_summary_enabled", !sync.data.config.experimental?.disable_paste_summary)
        ? "Disable paste summaries"
        : "Enable paste summaries",
      value: "app.toggle.paste_summary",
      search: "toggle paste summary",
      category: "System",
      onSelect: (dialog) => {
        kv.set(
          "paste_summary_enabled",
          !kv.get("paste_summary_enabled", !sync.data.config.experimental?.disable_paste_summary),
        )
        dialog.clear()
      },
    },
    {
      title: kv.get("animations_enabled", true) ? "Disable animations" : "Enable animations",
      value: "app.toggle.animations",
      search: "toggle animations",
      category: "System",
      onSelect: (dialog) => {
        kv.set("animations_enabled", !kv.get("animations_enabled", true))
        dialog.clear()
      },
    },
    {
      title: kv.get("diff_wrap_mode", "word") === "word" ? "Disable diff wrapping" : "Enable diff wrapping",
      value: "app.toggle.diffwrap",
      search: "toggle diff wrapping",
      category: "System",
      onSelect: (dialog) => {
        const current = kv.get("diff_wrap_mode", "word")
        kv.set("diff_wrap_mode", current === "word" ? "none" : "word")
        dialog.clear()
      },
    },
  ])

  sdk.event.on(TuiEvent.CommandExecute.type, (evt) => {
    command.trigger(evt.properties.command)
  })

  sdk.event.on(TuiEvent.ToastShow.type, (evt) => {
    toast.show({
      title: evt.properties.title,
      message: evt.properties.message,
      variant: evt.properties.variant,
      duration: evt.properties.duration,
    })
  })

  sdk.event.on(TuiEvent.SessionSelect.type, (evt) => {
    route.navigate({
      type: "session",
      sessionID: evt.properties.sessionID,
      source: "switch",
      workspaceID: route.data.workspaceID,
    })
  })

  sdk.event.on(SessionApi.Event.Deleted.type, (evt) => {
    if (route.data.type === "session" && route.data.sessionID === evt.properties.info.id) {
      route.navigate({ type: "home", workspaceID: route.data.workspaceID })
      toast.show({
        variant: "info",
        message: "The current session was deleted",
      })
    }
  })

  sdk.event.on(SessionApi.Event.Error.type, (evt) => {
    const error = evt.properties.error
    if (error && typeof error === "object" && error.name === "MessageAbortedError") return
    const message = (() => {
      if (!error) return "An error occurred"

      if (typeof error === "object") {
        const data = error.data
        if ("message" in data && typeof data.message === "string") {
          return data.message
        }
      }
      return String(error)
    })()

    toast.show({
      variant: "error",
      message,
      duration: 5000,
    })
  })

  sdk.event.on(Installation.Event.UpdateAvailable.type, (evt) => {
    toast.show({
      variant: "info",
      title: "Update Available",
      message: `SlopCode v${evt.properties.version} is available. Run 'slopcode upgrade' to update manually.`,
      duration: 10000,
    })
  })

  const plugin = createMemo(() => {
    if (!pluginsReady()) return
    if (route.data.type !== "plugin") return
    const render = routeView(route.data.id)
    if (!render) {
      return (
        <box flexGrow={1} alignItems="center" justifyContent="center" padding={2}>
          <text fg={theme.textMuted}>Plugin route {route.data.id} is unavailable.</text>
        </box>
      )
    }
    return render({ params: route.data.data })
  })

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
      onMouseDown={(evt) => {
        if (!Flag.SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT) return
        if (evt.button !== MouseButton.RIGHT) return

        if (!Selection.copy(renderer, toast)) return
        evt.preventDefault()
        evt.stopPropagation()
      }}
      onMouseUp={Flag.SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT ? undefined : () => Selection.copy(renderer, toast)}
    >
      <Switch>
        <Match when={route.data.type === "home"}>
          <Home />
        </Match>
        <Match when={route.data.type === "session"}>
          <Session />
        </Match>
      </Switch>
      {plugin()}
      <TuiPluginRuntime.Slot name="app" />
    </box>
  )
}

function ErrorComponent(props: {
  error: Error
  reset: () => void
  onExit: () => Promise<void>
  mode?: "dark" | "light"
}) {
  const term = useTerminalDimensions()
  const renderer = useRenderer()

  const handleExit = async () => {
    renderer.setTerminalTitle("")
    renderer.destroy()
    win32FlushInputBuffer()
    await props.onExit()
  }

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      handleExit()
    }
  })
  const [copied, setCopied] = createSignal(false)

  const issueURL = new URL("http://github.com/teamslop/slopcode/issues/new?template=bug-report.yml")

  // Choose safe fallback colors per mode since theme context may not be available
  const isLight = props.mode === "light"
  const colors = {
    bg: isLight ? "#ffffff" : "#0a0a0a",
    text: isLight ? "#1a1a1a" : "#eeeeee",
    muted: isLight ? "#8a8a8a" : "#808080",
    primary: isLight ? "#3b7dd8" : "#fab283",
  }

  if (props.error.message) {
    issueURL.searchParams.set("title", `opentui: fatal: ${props.error.message}`)
  }

  if (props.error.stack) {
    issueURL.searchParams.set(
      "description",
      "```\n" + props.error.stack.substring(0, 6000 - issueURL.toString().length) + "...\n```",
    )
  }

  issueURL.searchParams.set("slopcode-version", Installation.VERSION)

  const copyIssueURL = () => {
    Clipboard.copy(issueURL.toString()).then(() => {
      setCopied(true)
    })
  }

  return (
    <box flexDirection="column" gap={1} backgroundColor={colors.bg}>
      <box flexDirection="row" gap={1} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={colors.text}>
          Please report an issue.
        </text>
        <box onMouseUp={copyIssueURL} backgroundColor={colors.primary} padding={1}>
          <text attributes={TextAttributes.BOLD} fg={colors.bg}>
            Copy issue URL (exception info pre-filled)
          </text>
        </box>
        {copied() && <text fg={colors.muted}>Successfully copied</text>}
      </box>
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={colors.text}>A fatal error occurred!</text>
        <box onMouseUp={props.reset} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>Reset TUI</text>
        </box>
        <box onMouseUp={handleExit} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>Exit</text>
        </box>
      </box>
      <scrollbox height={Math.floor(term().height * 0.7)}>
        <text fg={colors.muted}>{props.error.stack}</text>
      </scrollbox>
      <text fg={colors.text}>{props.error.message}</text>
    </box>
  )
}
