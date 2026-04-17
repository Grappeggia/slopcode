import { useSync } from "@tui/context/sync"
import { createMemo, createResource, createSignal, For, Show, Switch, Match } from "solid-js"
import { createStore } from "solid-js/store"
import { selectedForeground, useTheme } from "../../context/theme"
import { Locale } from "@/util/locale"
import * as path from "path"
import type { AssistantMessage } from "@slopcode-ai/sdk/v2"
import { Installation } from "@/installation"
import { useKeybind } from "../../context/keybind"
import { useDirectory } from "../../context/directory"
import { useKV } from "../../context/kv"
import { TodoItem } from "../../component/todo-item"
import { useRoute } from "../../context/route"
import { useSDK } from "../../context/sdk"
import { usePromptRef } from "../../context/prompt"
import { useToast } from "../../ui/toast"
import { SESSION_SIDEBAR_RAIL_WIDTH, SESSION_SIDEBAR_WIDTH } from "./sidebar-layout"
import type { EditorTab } from "@tui/context/tab-state-store"

export type SidebarMode = "summary" | "files"

function ModeTab(props: { active: boolean; label: string; onSelect(): void }) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const bg = createMemo(() => {
    if (props.active) return theme.accent
    if (hover()) return theme.background
    return theme.backgroundElement
  })
  const fg = createMemo(() => {
    if (props.active) return selectedForeground(theme, bg())
    if (hover()) return theme.text
    return theme.textMuted
  })

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={bg()}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={props.onSelect}
    >
      <text fg={fg()} wrapMode="none">
        {props.label}
      </text>
    </box>
  )
}

function CollapseTab(props: { label: string; onSelect(): void }) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)

  return (
    <box
      width={3}
      justifyContent="center"
      backgroundColor={hover() ? theme.background : theme.backgroundElement}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={props.onSelect}
    >
      <text fg={hover() ? theme.text : theme.textMuted} wrapMode="none">
        {props.label}
      </text>
    </box>
  )
}

function FileRow(props: {
  icon: string
  label: string
  muted?: boolean
  underline?: boolean
  onSelect(): void
  action?: {
    label: string
    onSelect(): void
  }
}) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const fg = createMemo(() => {
    if (hover()) return theme.text
    if (props.muted) return theme.textMuted
    return theme.text
  })

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={props.onSelect}
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
    >
      <text fg={fg()} wrapMode="none">
        <span style={{ fg: fg() }}>{props.icon}</span>{" "}
        <span style={props.underline ? { underline: true } : {}}>{Locale.truncateMiddle(props.label, 27)}</span>
      </text>
      <Show when={props.action}>
        {(action) => (
          <text
            fg={theme.textMuted}
            wrapMode="none"
            onMouseUp={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              action().onSelect()
            }}
          >
            {action().label}
          </text>
        )}
      </Show>
    </box>
  )
}

function OpenFileRow(props: {
  tab: EditorTab
  active?: boolean
  onSelect(): void
  onSave(): void
  onClose(): void
}) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const fg = createMemo(() => {
    if (props.active) return theme.text
    if (hover()) return theme.text
    return theme.textMuted
  })

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
    >
      <box flexGrow={1} onMouseUp={props.onSelect}>
        <text fg={fg()} wrapMode="none">
          <span style={{ fg: fg() }}>{props.active ? "●" : "○"}</span>{" "}
          {Locale.truncateMiddle(props.tab.file, 16)}
          <Show when={props.tab.dirty}>
            <span style={{ fg: theme.warning }}> *</span>
          </Show>
        </text>
      </box>
      <box flexDirection="row" gap={1} flexShrink={0}>
        <text
          fg={theme.textMuted}
          wrapMode="none"
          onMouseUp={(evt) => {
            evt.preventDefault()
            evt.stopPropagation()
            props.onSave()
          }}
        >
          💾 save
        </text>
        <text
          fg={theme.textMuted}
          wrapMode="none"
          onMouseUp={(evt) => {
            evt.preventDefault()
            evt.stopPropagation()
            props.onClose()
          }}
        >
          ✕ close
        </text>
      </box>
    </box>
  )
}

function OpenFilesSection(props: {
  tabs: EditorTab[]
  activeFile?: string
  onSelect(file: string): void
  onSave(file: string): void
  onClose(file: string): void
}) {
  const { theme } = useTheme()

  return (
    <Show when={props.tabs.length > 0}>
      <box flexShrink={0} gap={1} paddingRight={1}>
        <text fg={theme.text}>
          <b>Open Files</b>
        </text>
        <For each={props.tabs}>
          {(tab) => (
            <OpenFileRow
              tab={tab}
              active={props.activeFile === tab.file}
              onSelect={() => props.onSelect(tab.file)}
              onSave={() => props.onSave(tab.file)}
              onClose={() => props.onClose(tab.file)}
            />
          )}
        </For>
      </box>
    </Show>
  )
}


function FilesSidebar(props: { openFile(file: string): void; modified: Set<string> }) {
  const sdk = useSDK()
  const keybind = useKeybind()
  const promptRef = usePromptRef()
  const toast = useToast()
  const { theme } = useTheme()
  const [dir, setDir] = createSignal("")
  const [failed, setFailed] = createSignal<string>()
  const [entries] = createResource(dir, async (dir) => {
    setFailed(undefined)
    const result = await sdk.client.file.list({ path: dir })
    if (result.error) {
      setFailed("Failed to load files")
      return []
    }
    return result.data ?? []
  })
  const title = createMemo(() => (dir() ? dir() : "."))
  const up = () => {
    if (!dir()) return
    const next = path.dirname(dir())
    setDir(next === "." ? "" : next)
  }

  return (
    <scrollbox
      flexGrow={1}
      verticalScrollbarOptions={{
        trackOptions: {
          backgroundColor: theme.background,
          foregroundColor: theme.borderActive,
        },
      }}
    >
      <box flexShrink={0} gap={1} paddingRight={1}>
        <box>
          <text fg={theme.text}>
            <b>File explorer</b>
          </text>
          <text fg={theme.textMuted}>{title()}</text>
          <text fg={theme.textMuted}>Select a file to attach it to the prompt.</text>
          <text fg={theme.textMuted}>{keybind.print("session_files")} reopens this view.</text>
        </box>
        <Show when={failed()}>
          <text fg={theme.error}>{failed()}</text>
        </Show>
        <Show when={entries.loading}>
          <text fg={theme.textMuted}>Loading files...</text>
        </Show>
        <Show when={!entries.loading && !failed() && !dir() && (entries() ?? []).length === 0}>
          <text fg={theme.textMuted}>No files found in this workspace.</text>
        </Show>
        <Show when={dir()}>
          <FileRow icon="↩" label=".." onSelect={up} />
        </Show>
        <For each={entries() ?? []}>
          {(item) => (
            <FileRow
              icon={item.type === "directory" ? "📂" : "·"}
              label={item.type === "directory" ? `${item.path}/` : item.path}
              muted={item.ignored}
              underline={item.type === "file" && props.modified.has(item.path)}
              action={
                item.type === "file"
                  ? {
                      label: "📂",
                      onSelect: () => props.openFile(item.path),
                    }
                  : undefined
              }
              onSelect={() => {
                if (item.type === "directory") {
                  setDir(item.path)
                  return
                }

                const prompt = promptRef.current
                if (!prompt) {
                  toast.show({ message: "Prompt is unavailable", variant: "error" })
                  return
                }

                if (!prompt.attachFile(item.path)) {
                  toast.show({ message: `${item.name} is already attached`, variant: "warning" })
                  return
                }

                toast.show({ message: `Attached ${item.path}`, variant: "success" })
              }}
            />
          )}
        </For>
      </box>
    </scrollbox>
  )
}

export function Sidebar(props: {
  sessionID: string
  overlay?: boolean
  collapsed: boolean
  mode: SidebarMode
  modified: Set<string>
  activeFile?: string
  editorTabs: EditorTab[]
  openFile(file: string): void
  saveFile(file: string): void
  closeFile(file: string): void
  setMode(mode: SidebarMode): void
  toggleCollapse(): void
}) {
  const sync = useSync()
  const { theme } = useTheme()
  const session = createMemo(() => sync.session.get(props.sessionID)!)
  const diff = createMemo(() => sync.data.session_diff[props.sessionID] ?? [])
  const todo = createMemo(() => sync.data.todo[props.sessionID] ?? [])
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])

  const [expanded, setExpanded] = createStore({
    mcp: true,
    diff: true,
    todo: true,
    lsp: true,
  })

  const mcpEntries = createMemo(() => Object.entries(sync.data.mcp).sort(([a], [b]) => a.localeCompare(b)))
  const connectedMcpCount = createMemo(() => mcpEntries().filter(([_, item]) => item.status === "connected").length)
  const errorMcpCount = createMemo(
    () =>
      mcpEntries().filter(
        ([_, item]) =>
          item.status === "failed" || item.status === "needs_auth" || item.status === "needs_client_registration",
      ).length,
  )

  const cost = createMemo(() => {
    const total = messages().reduce((sum, x) => sum + (x.role === "assistant" ? x.cost : 0), 0)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    return {
      tokens: total.toLocaleString(),
      percentage: model?.limit.context ? Math.round((total / model.limit.context) * 100) : null,
    }
  })

  const directory = useDirectory()
  const kv = useKV()
  const route = useRoute()

  const hasProviders = createMemo(() =>
    sync.data.provider.some((x) => x.id !== "slopcode" || Object.values(x.models).some((y) => y.cost?.input !== 0)),
  )
  const gettingStartedDismissed = createMemo(() => kv.get("dismissed_getting_started", false))

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={props.collapsed ? SESSION_SIDEBAR_RAIL_WIDTH : SESSION_SIDEBAR_WIDTH}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={props.collapsed ? 1 : 2}
        paddingRight={props.collapsed ? 1 : 2}
        position={props.overlay ? "absolute" : "relative"}
      >
        <Show when={props.collapsed}>
          <box flexGrow={1} alignItems="center" gap={1}>
            <CollapseTab label="<" onSelect={props.toggleCollapse} />
            <text fg={theme.textMuted} wrapMode="none">
              {props.mode === "summary" ? "S" : "F"}
            </text>
          </box>
        </Show>
        <Show when={!props.collapsed}>
          <box flexShrink={0} flexDirection="row" gap={1} paddingRight={1} paddingBottom={1}>
            <CollapseTab label=">" onSelect={props.toggleCollapse} />
            <ModeTab active={props.mode === "summary"} label="Summary" onSelect={() => props.setMode("summary")} />
            <ModeTab active={props.mode === "files"} label="Files" onSelect={() => props.setMode("files")} />
          </box>
          <OpenFilesSection
            tabs={props.editorTabs}
            activeFile={props.activeFile}
            onSelect={props.openFile}
            onSave={props.saveFile}
            onClose={props.closeFile}
          />
          <Switch>
            <Match when={props.mode === "files"}>
              <FilesSidebar openFile={props.openFile} modified={props.modified} />
            </Match>
            <Match when={true}>
              <scrollbox
                flexGrow={1}
                verticalScrollbarOptions={{
                  trackOptions: {
                    backgroundColor: theme.background,
                    foregroundColor: theme.borderActive,
                  },
                }}
              >
                <box flexShrink={0} gap={1} paddingRight={1}>
                  <box paddingRight={1}>
                    <text fg={theme.text}>
                      <b>{session().title}</b>
                    </text>
                    <Show when={session().share?.url}>
                      <text fg={theme.textMuted}>{session().share!.url}</text>
                    </Show>
                  </box>
                  <box>
                    <text fg={theme.text}>
                      <b>Context</b>
                    </text>
                    <text fg={theme.textMuted}>{context()?.tokens ?? 0} tokens</text>
                    <text fg={theme.textMuted}>{context()?.percentage ?? 0}% used</text>
                    <text fg={theme.textMuted}>{cost()} spent</text>
                  </box>
                  <Show when={mcpEntries().length > 0}>
                    <box>
                      <box
                        flexDirection="row"
                        gap={1}
                        onMouseDown={() => mcpEntries().length > 2 && setExpanded("mcp", !expanded.mcp)}
                      >
                        <Show when={mcpEntries().length > 2}>
                          <text fg={theme.text}>{expanded.mcp ? "▼" : "▶"}</text>
                        </Show>
                        <text fg={theme.text}>
                          <b>MCP</b>
                          <Show when={!expanded.mcp}>
                            <span style={{ fg: theme.textMuted }}>
                              {" "}
                              ({connectedMcpCount()} active
                              {errorMcpCount() > 0 ? `, ${errorMcpCount()} error${errorMcpCount() > 1 ? "s" : ""}` : ""}
                              )
                            </span>
                          </Show>
                        </text>
                      </box>
                      <Show when={mcpEntries().length <= 2 || expanded.mcp}>
                        <For each={mcpEntries()}>
                          {([key, item]) => (
                            <box flexDirection="row" gap={1}>
                              <text
                                flexShrink={0}
                                style={{
                                  fg: (
                                    {
                                      connected: theme.success,
                                      failed: theme.error,
                                      disabled: theme.textMuted,
                                      needs_auth: theme.warning,
                                      needs_client_registration: theme.error,
                                    } as Record<string, typeof theme.success>
                                  )[item.status],
                                }}
                              >
                                •
                              </text>
                              <text fg={theme.text} wrapMode="word">
                                {key}{" "}
                                <span style={{ fg: theme.textMuted }}>
                                  <Switch fallback={item.status}>
                                    <Match when={item.status === "connected"}>Connected</Match>
                                    <Match when={item.status === "failed" && item}>
                                      {(val) => <i>{val().error}</i>}
                                    </Match>
                                    <Match when={item.status === "disabled"}>Disabled</Match>
                                    <Match when={(item.status as string) === "needs_auth"}>Needs auth</Match>
                                    <Match when={(item.status as string) === "needs_client_registration"}>
                                      Needs client ID
                                    </Match>
                                  </Switch>
                                </span>
                              </text>
                            </box>
                          )}
                        </For>
                      </Show>
                    </box>
                  </Show>
                  <box>
                    <box
                      flexDirection="row"
                      gap={1}
                      onMouseDown={() => sync.data.lsp.length > 2 && setExpanded("lsp", !expanded.lsp)}
                    >
                      <Show when={sync.data.lsp.length > 2}>
                        <text fg={theme.text}>{expanded.lsp ? "▼" : "▶"}</text>
                      </Show>
                      <text fg={theme.text}>
                        <b>LSP</b>
                      </text>
                    </box>
                    <Show when={sync.data.lsp.length <= 2 || expanded.lsp}>
                      <Show when={sync.data.lsp.length === 0}>
                        <text fg={theme.textMuted}>
                          {sync.data.config.lsp === false
                            ? "LSPs have been disabled in settings"
                            : "LSPs will activate as files are read"}
                        </text>
                      </Show>
                      <For each={sync.data.lsp}>
                        {(item) => (
                          <box flexDirection="row" gap={1}>
                            <text
                              flexShrink={0}
                              style={{
                                fg: {
                                  connected: theme.success,
                                  error: theme.error,
                                }[item.status],
                              }}
                            >
                              •
                            </text>
                            <text fg={theme.textMuted}>
                              {item.id} {item.root}
                            </text>
                          </box>
                        )}
                      </For>
                    </Show>
                  </box>
                  <Show when={todo().length > 0 && todo().some((t) => t.status !== "completed")}>
                    <box>
                      <box
                        flexDirection="row"
                        gap={1}
                        onMouseDown={() => todo().length > 2 && setExpanded("todo", !expanded.todo)}
                      >
                        <Show when={todo().length > 2}>
                          <text fg={theme.text}>{expanded.todo ? "▼" : "▶"}</text>
                        </Show>
                        <text fg={theme.text}>
                          <b>Todo</b>
                        </text>
                      </box>
                      <Show when={todo().length <= 2 || expanded.todo}>
                        <For each={todo()}>{(todo) => <TodoItem status={todo.status} content={todo.content} />}</For>
                      </Show>
                    </box>
                  </Show>
                  <Show when={diff().length > 0}>
                    <box>
                      <box
                        flexDirection="row"
                        gap={1}
                        onMouseDown={() => diff().length > 2 && setExpanded("diff", !expanded.diff)}
                      >
                        <Show when={diff().length > 2}>
                          <text fg={theme.text}>{expanded.diff ? "▼" : "▶"}</text>
                        </Show>
                        <text fg={theme.text}>
                          <b>Modified Files</b>
                        </text>
                      </box>
                      <Show when={diff().length <= 2 || expanded.diff}>
                        <For each={diff() || []}>
                          {(item) => {
                            return (
                              <box flexDirection="row" gap={1} justifyContent="space-between">
                                <text
                                  fg={props.activeFile === item.file ? theme.text : theme.textMuted}
                                  wrapMode="none"
                                >
                                  <span style={props.modified.has(item.file) ? { underline: true } : {}}>
                                    {item.file}
                                  </span>
                                </text>
                                <box flexDirection="row" gap={1} flexShrink={0}>
                                  <text fg={theme.textMuted} onMouseUp={() => props.openFile(item.file)}>
                                    📂
                                  </text>
                                  <Show when={item.additions}>
                                    <text fg={theme.diffAdded}>+{item.additions}</text>
                                  </Show>
                                  <Show when={item.deletions}>
                                    <text fg={theme.diffRemoved}>-{item.deletions}</text>
                                  </Show>
                                </box>
                              </box>
                            )
                          }}
                        </For>
                      </Show>
                    </box>
                  </Show>
                </box>
              </scrollbox>
            </Match>
          </Switch>

          <box flexShrink={0} gap={1} paddingTop={1}>
            <Show when={!hasProviders() && !gettingStartedDismissed()}>
              <box
                backgroundColor={theme.backgroundElement}
                paddingTop={1}
                paddingBottom={1}
                paddingLeft={2}
                paddingRight={2}
                flexDirection="row"
                gap={1}
              >
                <text flexShrink={0} fg={theme.text}>
                  ⬖
                </text>
                <box flexGrow={1} gap={1}>
                  <box flexDirection="row" justifyContent="space-between">
                    <text fg={theme.text}>
                      <b>Getting started</b>
                    </text>
                    <text fg={theme.textMuted} onMouseDown={() => kv.set("dismissed_getting_started", true)}>
                      ✕
                    </text>
                  </box>
                  <text fg={theme.textMuted}>SlopCode includes free models so you can start immediately.</text>
                  <text fg={theme.textMuted}>
                    Connect from 75+ providers to use other models, including Claude, GPT, Gemini etc
                  </text>
                  <box flexDirection="row" gap={1} justifyContent="space-between">
                    <text fg={theme.text}>Connect provider</text>
                    <text fg={theme.textMuted}>/connect</text>
                  </box>
                </box>
              </box>
            </Show>
            <text>
              <span style={{ fg: theme.textMuted }}>{directory().split("/").slice(0, -1).join("/")}/</span>
              <span style={{ fg: theme.text }}>{directory().split("/").at(-1)}</span>
            </text>
            <Show when={route.data.type === "session" && route.data.workspaceID}>
              <text fg={theme.textMuted}>workspace {route.data.workspaceID}</text>
            </Show>
            <text fg={theme.textMuted}>
              <span style={{ fg: theme.success }}>•</span> <b>Slop</b>
              <span style={{ fg: theme.text }}>
                <b>Code</b>
              </span>{" "}
              <span>{Installation.VERSION}</span>
            </text>
          </box>
        </Show>
      </box>
    </Show>
  )
}
