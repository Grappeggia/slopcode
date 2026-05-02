import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createMemo, Match, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useKeybind } from "@tui/context/keybind"
import { useSessionTabs } from "../context/session-tabs"
import { adjacentTab } from "../context/session-tabs-state"
import { useKeyboard } from "@opentui/solid"
import { Logo } from "../component/logo"
import { Tips } from "../component/tips"
import { Locale } from "@/util/locale"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { Installation } from "@/installation"
import { useKV } from "../context/kv"
import { useCommandDialog } from "../component/dialog-command"
import { ShortcutHint } from "../ui/shortcut-hint"
import { SessionStrip } from "./session/session-strip"
import { TuiPluginRuntime } from "../plugin/runtime"

let argsPromptSubmitted = false

export function Home() {
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const workspace = createMemo(() => route.workspaceID)
  const promptRef = usePromptRef()
  const command = useCommandDialog()
  const tabs = useSessionTabs()
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const isFirstTimeUser = createMemo(() => sync.data.session.length === 0)
  const tipsHidden = createMemo(() => kv.get("tips_hidden", false))
  const showTips = createMemo(() => {
    if (isFirstTimeUser()) return false
    return !tipsHidden()
  })

  command.register(() => [
    {
      title: tipsHidden() ? "Show tips" : "Hide tips",
      value: "tips.toggle",
      search: "toggle tips",
      keybind: "tips_toggle",
      category: "System",
      onSelect: (dialog) => {
        kv.set("tips_hidden", !tipsHidden())
        dialog.clear()
      },
    },
  ])

  const keybind = useKeybind()
  const openTab = (offset: 1 | -1) => {
    if (!tabs.switchable()) return false
    const next = adjacentTab(tabs.ids(), tabs.active(), offset)
    if (!next) return false
    tabs.open(next)
    return true
  }

  useKeyboard((evt) => {
    if (keybind.match("session_tabs_previous", evt)) {
      if (!openTab(-1)) return
      keybind.keep()
      evt.preventDefault()
      return
    }

    if (keybind.match("session_tabs_next", evt)) {
      if (!openTab(1)) return
      keybind.keep()
      evt.preventDefault()
    }
  })

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <Switch>
          <Match when={mcpError()}>
            <box flexDirection="row" gap={1} alignItems="center">
              <text fg={theme.text}>
                <span style={{ fg: theme.error }}>•</span> mcp errors
              </text>
              <ShortcutHint
                shortcut={keybind.print("status_view")}
                label="status"
                onTrigger={() => command.trigger("slopcode.status")}
              />
            </box>
          </Match>
          <Match when={true}>
            <text fg={theme.text}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </text>
          </Match>
        </Switch>
      </box>
    </Show>
  )

  let prompt: PromptRef
  const args = useArgs()
  onMount(() => {
    if (route.initialPrompt) {
      prompt.set(route.initialPrompt)
      return
    }
    if (argsPromptSubmitted || !args.prompt) return
    argsPromptSubmitted = true
    prompt.set({ input: args.prompt, parts: [] })
    prompt.submit()
  })
  const directory = useDirectory()

  return (
    <>
      <SessionStrip />
      <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <TuiPluginRuntime.Slot name="home_logo" mode="replace">
          <box flexShrink={0}>
            <Logo />
          </box>
        </TuiPluginRuntime.Slot>
        <box height={1} minHeight={0} flexShrink={1} />
        <TuiPluginRuntime.Slot
          name="home_prompt"
          mode="replace"
          workspace_id={workspace()}
          ref={(r) => {
            if (r) promptRef.set(r as PromptRef)
          }}
        >
          <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
            <Prompt
              ref={(r) => {
                prompt = r
                promptRef.set(r)
              }}
              hint={Hint}
              right={<TuiPluginRuntime.Slot name="home_prompt_right" workspace_id={workspace()} />}
              workspaceID={workspace()}
              showHistoryHint={false}
            />
          </box>
        </TuiPluginRuntime.Slot>
        <TuiPluginRuntime.Slot name="home_bottom">
          <box height={4} minHeight={0} width="100%" maxWidth={75} alignItems="center" paddingTop={3} flexShrink={1}>
            <Show when={showTips()}>
              <Tips />
            </Show>
          </box>
        </TuiPluginRuntime.Slot>
        <box flexGrow={1} minHeight={0} />
        <Toast />
      </box>
      <TuiPluginRuntime.Slot name="home_footer">
        <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
          <text fg={theme.textMuted}>{directory()}</text>
          <Show when={workspace()}>
            <text fg={theme.textMuted}>workspace {workspace()}</text>
          </Show>
          <box gap={1} flexDirection="row" flexShrink={0}>
            <Show when={mcp()}>
              <text fg={theme.text}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: connectedMcpCount() > 0 ? theme.success : theme.textMuted }}>⊙ </span>
                  </Match>
                </Switch>
                {connectedMcpCount()} MCP
              </text>
              <text fg={theme.textMuted}>/status</text>
            </Show>
          </box>
          <box flexGrow={1} />
          <box flexShrink={0}>
            <text fg={theme.textMuted}>{Installation.VERSION}</text>
          </box>
        </box>
      </TuiPluginRuntime.Slot>
    </>
  )
}
