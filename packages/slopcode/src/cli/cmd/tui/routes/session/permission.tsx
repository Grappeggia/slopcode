import { createStore } from "solid-js/store"
import { createEffect, createMemo, For, Match, Show, Switch } from "solid-js"
import { Portal, useKeyboard, useRenderer, useTerminalDimensions, type JSX } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"
import { useKeybind } from "../../context/keybind"
import { useTheme, selectedForeground } from "../../context/theme"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { useSDK } from "../../context/sdk"
import { SplitBorder } from "../../component/border"
import { useSync } from "../../context/sync"
import { useTextareaKeybindings } from "../../component/textarea-keybindings"
import path from "path"
import { LANGUAGE_EXTENSIONS } from "@/lsp/language"
import { Keybind } from "@/util/keybind"
import { Locale } from "@/util/locale"
import { Global } from "@/global"
import { useDialog } from "../../ui/dialog"
import { useTuiConfig } from "../../context/tui-config"
import { ShortcutHint } from "../../ui/shortcut-hint"
import type { MessageV2 } from "@/session/message-v2"

type PermissionStage = "permission" | "always" | "reject"

function normalizePath(input?: string) {
  if (!input) return ""

  const cwd = process.cwd()
  const home = Global.Path.home
  const absolute = path.isAbsolute(input) ? input : path.resolve(cwd, input)
  const relative = path.relative(cwd, absolute)

  if (!relative) return "."
  if (!relative.startsWith("..")) return relative

  // outside cwd - use ~ or absolute
  if (home && (absolute === home || absolute.startsWith(home + path.sep))) {
    return absolute.replace(home, "~")
  }
  return absolute
}

function filetype(input?: string) {
  if (!input) return "none"
  const ext = path.extname(input)
  const language = LANGUAGE_EXTENSIONS[ext]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}

function EditBody(props: { request: PermissionRequest }) {
  const themeState = useTheme()
  const theme = themeState.theme
  const syntax = themeState.syntax
  const config = useTuiConfig()
  const dimensions = useTerminalDimensions()

  const filepath = createMemo(() => (props.request.metadata?.filepath as string) ?? "")
  const diff = createMemo(() => (props.request.metadata?.diff as string) ?? "")

  const view = createMemo(() => {
    const diffStyle = config.diff_style
    if (diffStyle === "stacked") return "unified"
    return dimensions().width > 120 ? "split" : "unified"
  })

  const ft = createMemo(() => filetype(filepath()))

  return (
    <box flexDirection="column" gap={1}>
      <Show when={diff()}>
        <scrollbox
          height="100%"
          verticalScrollbarOptions={{
            trackOptions: {
              backgroundColor: theme.background,
              foregroundColor: theme.borderActive,
            },
          }}
        >
          <diff
            diff={diff()}
            view={view()}
            filetype={ft()}
            syntaxStyle={syntax()}
            showLineNumbers={true}
            width="100%"
            wrapMode="word"
            fg={theme.text}
            addedBg={theme.diffAddedBg}
            removedBg={theme.diffRemovedBg}
            contextBg={theme.diffContextBg}
            addedSignColor={theme.diffHighlightAdded}
            removedSignColor={theme.diffHighlightRemoved}
            lineNumberFg={theme.diffLineNumber}
            lineNumberBg={theme.diffContextBg}
            addedLineNumberBg={theme.diffAddedLineNumberBg}
            removedLineNumberBg={theme.diffRemovedLineNumberBg}
          />
        </scrollbox>
      </Show>
      <Show when={!diff()}>
        <box paddingLeft={1}>
          <text fg={theme.textMuted}>No diff provided</text>
        </box>
      </Show>
    </box>
  )
}

function TextBody(props: { title: string; description?: string; icon?: string }) {
  const { theme } = useTheme()
  return (
    <>
      <box flexDirection="row" gap={1} paddingLeft={1}>
        <Show when={props.icon}>
          <text fg={theme.textMuted} flexShrink={0}>
            {props.icon}
          </text>
        </Show>
        <text fg={theme.textMuted}>{props.title}</text>
      </box>
      <Show when={props.description}>
        <box paddingLeft={1}>
          <text fg={theme.text}>{props.description}</text>
        </box>
      </Show>
    </>
  )
}

export function PermissionPrompt(props: { requests: PermissionRequest[]; sessionID?: string }) {
  const sdk = useSDK()
  const sync = useSync()
  const dialog = useDialog()
  const [store, setStore] = createStore({
    stage: "permission" as PermissionStage,
    focused: 0,
    selected: [] as string[],
    known: [] as string[],
  })

  const requests = createMemo(() => props.requests)

  createEffect(() => {
    const ids = requests().map((item) => item.id)
    setStore((value) => {
      const selected = value.selected.filter((id) => ids.includes(id))
      const known = value.known.filter((id) => ids.includes(id))
      for (const id of ids) {
        if (known.includes(id)) continue
        known.push(id)
        selected.push(id)
      }
      return {
        ...value,
        selected,
        known,
        focused: Math.min(value.focused, Math.max(ids.length - 1, 0)),
      }
    })
  })

  function session(request?: PermissionRequest) {
    return sync.data.session.find((item) => item.id === request?.sessionID)
  }

  function part(request?: PermissionRequest) {
    const tool = request?.tool
    if (!tool) return
    return (sync.data.part[tool.messageID] ?? []).find(
      (part): part is MessageV2.ToolPart => part.type === "tool" && part.callID === tool.callID,
    )
  }

  function input(request?: PermissionRequest) {
    return part(request)?.state.input ?? {}
  }

  function firstPattern(request?: PermissionRequest) {
    return request?.patterns.find((item): item is string => typeof item === "string") ?? ""
  }

  function sessionTitle(request?: PermissionRequest) {
    return session(request)?.title?.trim() || request?.sessionID || ""
  }

  function sourceLabel(request?: PermissionRequest) {
    if (!request || !props.sessionID || request.sessionID === props.sessionID) return ""
    return `Child session: ${sessionTitle(request)}`
  }

  const { theme } = useTheme()

  function Line(props: {
    children?: JSX.Element
    fg?: typeof theme.text
    bg?: typeof theme.backgroundPanel
    clamp?: boolean
  }) {
    const bg = () => props.bg ?? theme.backgroundPanel
    if (props.clamp) {
      return (
        <text fg={props.fg ?? theme.textMuted} bg={bg()} width="100%" wrapMode="none" overflow="hidden">
          {props.children}
        </text>
      )
    }
    return (
      <text fg={props.fg ?? theme.textMuted} bg={bg()} width="100%" wrapMode="word">
        {props.children}
      </text>
    )
  }

  const focused = createMemo(() => requests()[store.focused] ?? requests()[0])
  const selected = createMemo(() => requests().filter((item) => store.selected.includes(item.id)))
  const selectedCount = createMemo(() => selected().length)
  const forecastCount = createMemo(() => requests().filter((item) => item.kind === "forecast").length)
  const blockingCount = createMemo(() => requests().length - forecastCount())
  const planned = createMemo(() => requests().length > 0 && blockingCount() === 0)
  const mixed = createMemo(() => blockingCount() > 0 && forecastCount() > 0)
  const child = createMemo(() => selected().some((item) => session(item)?.parentID))

  function toggle(id: string) {
    setStore("selected", (value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id]))
  }

  function move(step: number) {
    if (requests().length === 0) return
    setStore("focused", (value) => (value + step + requests().length) % requests().length)
  }

  async function reply(reply: "once" | "always" | "reject", message?: string) {
    const list = selected()
    if (list.length === 0) return
    await Promise.all(
      list.map((item) =>
        sdk.client.permission
          .reply({
            reply,
            requestID: item.id,
            sessionID: item.sessionID,
            message,
          })
          .catch(() => undefined),
      ),
    )
  }

  useKeyboard((evt) => {
    if (dialog.stack.length > 0 || store.stage !== "permission") return

    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      move(-1)
      return
    }

    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      move(1)
      return
    }

    if (evt.name === "space") {
      const current = focused()
      if (!current) return
      evt.preventDefault()
      toggle(current.id)
    }
  })

  function info(request?: PermissionRequest) {
    if (!request) {
      return {
        icon: "⚙",
        title: "No permission selected",
        body: (
          <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
            <Line>Select one or more permissions to continue.</Line>
          </box>
        ),
      }
    }

    const permission = request.permission
    const data = input(request)

    if (permission === "edit") {
      const raw = request.metadata?.filepath
      const filepath = typeof raw === "string" && raw ? raw : firstPattern(request)
      const diff = typeof request.metadata?.diff === "string" ? request.metadata.diff : ""
      return {
        icon: "->",
        title: filepath ? `Edit ${normalizePath(filepath)}` : "Edit file",
        body: diff ? (
          <EditBody request={request} />
        ) : (
          <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
            <Line clamp>{filepath ? "Path: " + normalizePath(filepath) : "No diff provided"}</Line>
          </box>
        ),
      }
    }

    if (permission === "read") {
      const raw = data.filePath
      const filePath = typeof raw === "string" && raw ? raw : firstPattern(request)
      return {
        icon: "->",
        title: filePath ? `Read ${normalizePath(filePath)}` : "Read file",
        body: (
          <Show when={filePath}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"Path: " + normalizePath(filePath)}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "glob") {
      const pattern = typeof data.pattern === "string" ? data.pattern : ""
      return {
        icon: "*",
        title: `Glob "${pattern}"`,
        body: (
          <Show when={pattern}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"Pattern: " + pattern}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "grep") {
      const pattern = typeof data.pattern === "string" ? data.pattern : ""
      return {
        icon: "*",
        title: `Grep "${pattern}"`,
        body: (
          <Show when={pattern}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"Pattern: " + pattern}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "list") {
      const raw = data.path
      const dir = typeof raw === "string" && raw ? raw : firstPattern(request)
      return {
        icon: "->",
        title: dir ? `List ${normalizePath(dir)}` : "List directory",
        body: (
          <Show when={dir}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"Path: " + normalizePath(dir)}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "bash") {
      const title = typeof data.description === "string" && data.description ? data.description : "Shell command"
      const command = typeof data.command === "string" ? data.command : ""
      return {
        icon: "#",
        title,
        body: (
          <Show when={command}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line fg={theme.text} clamp>
                {"$ " + command}
              </Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "task") {
      const type = typeof data.subagent_type === "string" ? data.subagent_type : "Unknown"
      const desc = typeof data.description === "string" ? data.description : ""
      return {
        icon: "#",
        title: `${Locale.titlecase(type)} Task`,
        body: (
          <Show when={desc}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line fg={theme.text} clamp>
                {"o " + desc}
              </Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "webfetch") {
      const url = typeof data.url === "string" ? data.url : ""
      return {
        icon: "%",
        title: `WebFetch ${url}`,
        body: (
          <Show when={url}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"URL: " + url}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "websearch") {
      const query = typeof data.query === "string" ? data.query : ""
      return {
        icon: "o",
        title: `Exa Web Search "${query}"`,
        body: (
          <Show when={query}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"Query: " + query}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "codesearch") {
      const query = typeof data.query === "string" ? data.query : ""
      return {
        icon: "o",
        title: `Exa Code Search "${query}"`,
        body: (
          <Show when={query}>
            <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
              <Line clamp>{"Query: " + query}</Line>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "external_directory") {
      const meta = request.metadata ?? {}
      const parent = typeof meta["parentDir"] === "string" ? meta["parentDir"] : undefined
      const filepath = typeof meta["filepath"] === "string" ? meta["filepath"] : undefined
      const pattern = request.patterns?.[0]
      const derived =
        typeof pattern === "string" ? (pattern.includes("*") ? path.dirname(pattern) : pattern) : undefined

      const raw = parent ?? filepath ?? derived
      const dir = normalizePath(raw)
      const patterns = (request.patterns ?? []).filter((item): item is string => typeof item === "string")

      return {
        icon: "<-",
        title: `Access external directory ${dir}`,
        body: (
          <Show when={patterns.length > 0}>
            <box paddingLeft={1} gap={1} backgroundColor={theme.backgroundPanel}>
              <Line>Patterns</Line>
              <box flexDirection="column" backgroundColor={theme.backgroundPanel}>
                <For each={patterns}>
                  {(item) => (
                    <Line fg={theme.text} clamp>
                      {"- " + item}
                    </Line>
                  )}
                </For>
              </box>
            </box>
          </Show>
        ),
      }
    }

    if (permission === "doom_loop") {
      return {
        icon: "o",
        title: "Continue after repeated failures",
        body: (
          <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
            <Line>This keeps the session running despite repeated failures.</Line>
          </box>
        ),
      }
    }

    return {
      icon: "*",
      title: `Call tool ${permission}`,
      body: (
        <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
          <Line clamp>{"Tool: " + permission}</Line>
        </box>
      ),
    }
  }

  function title(request?: PermissionRequest) {
    const data = input(request)
    const tool = part(request)?.tool ?? request?.permission

    if (tool === "edit") {
      const raw = typeof request?.metadata?.filepath === "string" ? request.metadata.filepath : ""
      const filepath = raw || firstPattern(request)
      if (filepath) return `Edit ${normalizePath(filepath)}`
      return "Edit file"
    }

    if (tool === "read") {
      const filePath = (typeof data.filePath === "string" ? data.filePath : "") || firstPattern(request)
      if (filePath) return `Read ${normalizePath(filePath)}`
      return "Read file"
    }

    if (tool === "glob") {
      const pattern = typeof data.pattern === "string" ? data.pattern : ""
      const dir = typeof data.path === "string" ? normalizePath(data.path) : ""
      if (dir) return `Glob "${pattern}" in ${dir}`
      return `Glob "${pattern}"`
    }

    if (tool === "grep") {
      const pattern = typeof data.pattern === "string" ? data.pattern : ""
      const dir = typeof data.path === "string" ? normalizePath(data.path) : ""
      if (dir) return `Grep "${pattern}" in ${dir}`
      return `Grep "${pattern}"`
    }

    if (tool === "list") {
      const dir = (typeof data.path === "string" ? data.path : "") || firstPattern(request)
      if (dir) return `List ${normalizePath(dir)}`
      return "List directory"
    }

    if (tool === "bash") {
      const desc = typeof data.description === "string" && data.description ? data.description : "Shell command"
      const workdir =
        typeof data.workdir === "string" && data.workdir && data.workdir !== "." ? normalizePath(data.workdir) : ""
      if (workdir && !desc.includes(workdir)) return `${desc} in ${workdir}`
      return desc
    }

    if (tool === "task") {
      const type = typeof data.subagent_type === "string" ? data.subagent_type : "Unknown"
      const desc = typeof data.description === "string" ? data.description : ""
      if (desc) return `${Locale.titlecase(type)} Task: ${desc}`
      return `${Locale.titlecase(type)} Task`
    }

    if (tool === "webfetch") {
      const url = typeof data.url === "string" ? data.url : ""
      return `WebFetch ${url}`
    }

    if (tool === "websearch") {
      const query = typeof data.query === "string" ? data.query : ""
      return `Exa Web Search "${query}"`
    }

    if (tool === "codesearch") {
      const query = typeof data.query === "string" ? data.query : ""
      return `Exa Code Search "${query}"`
    }

    return info(request).title
  }

  function row(request?: PermissionRequest) {
    const current = info(request)
    const primary = title(request)
    const data = input(request)
    const details = [] as string[]
    const grant = primary === current.title ? "" : `Grants ${current.title}`
    const source = sourceLabel(request)
    if (source) details.push(source)
    if (request?.kind === "forecast") details.push("Planned for build")
    if (grant) details.push(grant)

    if (request?.permission === "external_directory") {
      const pattern = request.patterns?.find((item): item is string => typeof item === "string")
      if (pattern) details.push(pattern)
    }

    if ((part(request)?.tool ?? request?.permission) === "bash") {
      const command = typeof data.command === "string" ? data.command : ""
      if (command) details.push(`$ ${Locale.truncate(command, 80)}`)
    }

    return {
      current,
      primary,
      secondary: details.filter(Boolean).join(" • "),
      reason: request?.reason,
      preview: request?.permission === "edit" && typeof request?.metadata?.diff === "string" && !!request.metadata.diff,
    }
  }

  const current = createMemo(() => info(focused()))

  return (
    <Switch>
      <Match when={store.stage === "always"}>
        <Prompt
          title="Always allow"
          body={
            <Switch>
              <Match
                when={selected().length === 1 && selected()[0]?.always.length === 1 && selected()[0]?.always[0] === "*"}
              >
                <TextBody
                  title={"This will remember " + selected()[0]!.permission + " for this project until revoked."}
                />
              </Match>
              <Match when={true}>
                <box paddingLeft={1} gap={1} backgroundColor={theme.backgroundPanel}>
                  <Line>This will remember the selected permissions for this project until revoked.</Line>
                  <For each={selected()}>
                    {(request) => (
                      <box flexDirection="column" gap={0} backgroundColor={theme.backgroundPanel}>
                        <Line fg={theme.text} clamp>
                          {row(request).primary}
                        </Line>
                        <Show when={row(request).secondary}>
                          <Line clamp>{row(request).secondary}</Line>
                        </Show>
                        <box paddingLeft={1} flexDirection="column" backgroundColor={theme.backgroundPanel}>
                          <For each={request.always.length > 0 ? request.always : request.patterns}>
                            {(pattern) => <Line clamp>{"- " + pattern}</Line>}
                          </For>
                        </box>
                      </box>
                    )}
                  </For>
                </box>
              </Match>
            </Switch>
          }
          options={{ confirm: "Confirm", cancel: "Cancel" }}
          escapeKey="cancel"
          onSelect={(option) => {
            setStore("stage", "permission")
            if (option === "cancel") return
            void reply("always")
          }}
        />
      </Match>
      <Match when={store.stage === "reject"}>
        <RejectPrompt
          onConfirm={(message) => {
            void reply("reject", message || undefined)
          }}
          onCancel={() => {
            setStore("stage", "permission")
          }}
        />
      </Match>
      <Match when={store.stage === "permission"}>
        {(() => {
          const header = () => (
            <box flexDirection="column" gap={0}>
              <box flexDirection="row" gap={1} flexShrink={0}>
                <text fg={theme.warning}>{"△"}</text>
                <text fg={theme.text}>
                  {planned() ? "Review build permissions" : mixed() ? "Review permissions" : "Permission required"}
                </text>
                <Show when={requests().length > 1}>
                  <text fg={theme.textMuted}>{`(${selected().length}/${requests().length} selected)`}</text>
                </Show>
              </box>
              <Show when={planned() || mixed()}>
                <box paddingLeft={2} flexShrink={0} backgroundColor={theme.backgroundPanel}>
                  <Line>
                    {mixed()
                      ? `${blockingCount()} need approval now - ${forecastCount()} planned for build`
                      : `${forecastCount()} planned for build`}
                  </Line>
                </box>
              </Show>
              <Show
                when={requests().length === 1}
                fallback={
                  <box paddingLeft={2} flexShrink={0} backgroundColor={theme.backgroundPanel}>
                    <Line>Actions apply only to selected rows. Unselected permissions stay pending.</Line>
                  </box>
                }
              >
                <box flexDirection="row" gap={1} paddingLeft={2} flexShrink={0} backgroundColor={theme.backgroundPanel}>
                  <text fg={theme.textMuted} bg={theme.backgroundPanel} flexShrink={0}>
                    {current().icon}
                  </text>
                  <text fg={theme.text} bg={theme.backgroundPanel} wrapMode="none" overflow="hidden">
                    {current().title}
                  </text>
                </box>
              </Show>
            </box>
          )

          const body = (
            <Prompt
              title={planned() ? "Review build permissions" : mixed() ? "Review permissions" : "Permission required"}
              header={header()}
              body={
                <box flexDirection="column" gap={1}>
                  <Show when={requests().length > 1}>
                    <box paddingLeft={1} flexDirection="column" backgroundColor={theme.backgroundPanel}>
                      <Line>Use up/down to focus and space to toggle the focused permission.</Line>
                    </box>
                    <scrollbox height={Math.min(Math.max(requests().length * 3, 6), 12)}>
                      <box flexDirection="column">
                        <For each={requests()}>
                          {(request, index) => {
                            const active = () => index() === store.focused
                            const picked = () => store.selected.includes(request.id)
                            const item = () => row(request)
                            const bg = () => (active() ? theme.backgroundElement : theme.backgroundPanel)
                            return (
                              <box
                                flexDirection="column"
                                paddingLeft={1}
                                paddingRight={1}
                                backgroundColor={bg()}
                                onMouseOver={() => setStore("focused", index())}
                                onMouseDown={() => setStore("focused", index())}
                                onMouseUp={() => toggle(request.id)}
                              >
                                <Line
                                  fg={active() ? theme.secondary : picked() ? theme.text : theme.textMuted}
                                  bg={bg()}
                                  clamp
                                >
                                  {`${picked() ? "[x]" : "[ ]"} ${item().primary}`}
                                </Line>
                                <Show when={item().secondary}>
                                  <box paddingLeft={4} backgroundColor={bg()}>
                                    <Line bg={bg()} clamp>
                                      {item().secondary}
                                    </Line>
                                  </box>
                                </Show>
                                <Show when={item().reason}>
                                  <box paddingLeft={4} backgroundColor={bg()}>
                                    <Line bg={bg()} clamp>
                                      {(request.kind === "forecast" ? "Planned need: " : "Reason: ") + item().reason}
                                    </Line>
                                  </box>
                                </Show>
                              </box>
                            )
                          }}
                        </For>
                      </box>
                    </scrollbox>
                  </Show>
                  <Show when={requests().length === 1 && focused()?.reason}>
                    <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
                      <Line>
                        {(focused()!.kind === "forecast" ? "Planned need: " : "Reason: ") + focused()!.reason}
                      </Line>
                    </box>
                  </Show>
                  <Show when={requests().length === 1 && row(focused()).secondary}>
                    <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
                      <Line clamp>{row(focused()).secondary}</Line>
                    </box>
                  </Show>
                  <Show when={blockingCount() > 0}>
                    <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
                      <Line>Reject stops the selected blocked action for each affected session.</Line>
                    </box>
                  </Show>
                  <Show when={requests().length === 1 || row(focused()).preview}>{current().body}</Show>
                </box>
              }
              options={{
                once: selectedCount() > 1 ? `Allow once (${selectedCount()})` : "Allow once",
                always: selectedCount() > 1 ? `Allow always (${selectedCount()})` : "Allow always",
                reject: selectedCount() > 1 ? `Reject (${selectedCount()})` : "Reject",
              }}
              escapeKey="reject"
              fullscreen
              onSelect={(option) => {
                if (option === "always") {
                  setStore("stage", "always")
                  return
                }
                if (option === "reject") {
                  if (child()) {
                    setStore("stage", "reject")
                    return
                  }
                  void reply("reject")
                  return
                }
                void reply("once")
              }}
            />
          )

          return body
        })()}
      </Match>
    </Switch>
  )
}

function RejectPrompt(props: { onConfirm: (message: string) => void; onCancel: () => void }) {
  let input: TextareaRenderable
  const { theme } = useTheme()
  const keybind = useKeybind()
  const textareaKeybindings = useTextareaKeybindings()
  const dimensions = useTerminalDimensions()
  const narrow = createMemo(() => dimensions().width < 80)
  const dialog = useDialog()

  function Line(props: { children?: JSX.Element; fg?: typeof theme.text; bg?: typeof theme.backgroundPanel }) {
    return (
      <text fg={props.fg ?? theme.textMuted} bg={props.bg ?? theme.backgroundPanel} width="100%" wrapMode="word">
        {props.children}
      </text>
    )
  }

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return

    if (evt.name === "escape" || keybind.match("app_exit", evt)) {
      evt.preventDefault()
      props.onCancel()
      return
    }
    if (evt.name === "return") {
      evt.preventDefault()
      props.onConfirm(input.plainText)
    }
  })

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={theme.error}
      customBorderChars={SplitBorder.customBorderChars}
    >
      <box
        gap={1}
        paddingLeft={1}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={theme.backgroundPanel}
      >
        <box flexDirection="row" gap={1} paddingLeft={1} backgroundColor={theme.backgroundPanel}>
          <text fg={theme.error} bg={theme.backgroundPanel}>
            {"△"}
          </text>
          <text fg={theme.text} bg={theme.backgroundPanel} wrapMode="none" overflow="hidden">
            Reject permission
          </text>
        </box>
        <box paddingLeft={1} backgroundColor={theme.backgroundPanel}>
          <Line>Tell SlopCode what to do differently</Line>
        </box>
      </box>
      <box
        flexDirection={narrow() ? "column" : "row"}
        flexShrink={0}
        paddingTop={1}
        paddingLeft={2}
        paddingRight={3}
        paddingBottom={1}
        backgroundColor={theme.backgroundElement}
        justifyContent={narrow() ? "flex-start" : "space-between"}
        alignItems={narrow() ? "flex-start" : "center"}
        gap={1}
      >
        <textarea
          ref={(val: TextareaRenderable) => (input = val)}
          focused
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.primary}
          keyBindings={textareaKeybindings()}
        />
        <box flexDirection="row" gap={2} flexShrink={0} backgroundColor={theme.backgroundElement}>
          <text fg={theme.text} bg={theme.backgroundElement} wrapMode="none">
            enter confirm
          </text>
          <text fg={theme.text} bg={theme.backgroundElement} wrapMode="none">
            esc cancel
          </text>
        </box>
      </box>
    </box>
  )
}

function Prompt<const T extends Record<string, string>>(props: {
  title: string
  header?: JSX.Element
  body: JSX.Element
  options: T
  escapeKey?: keyof T
  fullscreen?: boolean
  onSelect: (option: keyof T) => void
}) {
  const { theme } = useTheme()
  const keybind = useKeybind()
  const dimensions = useTerminalDimensions()
  const keys = Object.keys(props.options) as (keyof T)[]
  const [store, setStore] = createStore({
    selected: keys[0],
    expanded: false,
  })
  const diffKey = Keybind.parse("ctrl+f")[0]
  const narrow = createMemo(() => dimensions().width < 80)
  const dialog = useDialog()
  const toggle = () => setStore("expanded", (v) => !v)
  const cycle = (step: number) => {
    const idx = keys.indexOf(store.selected)
    const next = keys[(idx + step + keys.length) % keys.length]
    setStore("selected", next)
  }

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return

    if (evt.name === "left" || evt.name == "h") {
      evt.preventDefault()
      cycle(-1)
    }

    if (evt.name === "right" || evt.name == "l") {
      evt.preventDefault()
      cycle(1)
    }

    if (evt.name === "return") {
      evt.preventDefault()
      props.onSelect(store.selected)
    }

    if (props.escapeKey && (evt.name === "escape" || keybind.match("app_exit", evt))) {
      evt.preventDefault()
      props.onSelect(props.escapeKey)
    }

    if (props.fullscreen && diffKey && Keybind.match(diffKey, keybind.parse(evt))) {
      evt.preventDefault()
      evt.stopPropagation()
      toggle()
    }
  })

  const hint = createMemo(() => (store.expanded ? "minimize" : "fullscreen"))
  const renderer = useRenderer()

  const content = () => (
    <box
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={theme.warning}
      customBorderChars={SplitBorder.customBorderChars}
      {...(store.expanded
        ? { top: dimensions().height * -1 + 1, bottom: 1, left: 2, right: 2, position: "absolute" }
        : {
            top: 0,
            maxHeight: 15,
            bottom: 0,
            left: 0,
            right: 0,
            position: "relative",
          })}
    >
      <box gap={1} paddingLeft={1} paddingRight={3} paddingTop={1} paddingBottom={1} flexGrow={1}>
        <Show
          when={props.header}
          fallback={
            <box flexDirection="row" gap={1} paddingLeft={1} flexShrink={0}>
              <text fg={theme.warning}>{"△"}</text>
              <text fg={theme.text}>{props.title}</text>
            </box>
          }
        >
          <box paddingLeft={1} flexShrink={0}>
            {props.header}
          </box>
        </Show>
        {props.body}
      </box>
      <box
        flexDirection={narrow() ? "column" : "row"}
        flexShrink={0}
        gap={1}
        paddingTop={1}
        paddingLeft={2}
        paddingRight={3}
        paddingBottom={1}
        backgroundColor={theme.backgroundElement}
        justifyContent={narrow() ? "flex-start" : "space-between"}
        alignItems={narrow() ? "flex-start" : "center"}
      >
        <box flexDirection="row" gap={1} flexShrink={0}>
          <For each={keys}>
            {(option) => (
              <box
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={option === store.selected ? theme.warning : theme.backgroundMenu}
                onMouseOver={() => setStore("selected", option)}
                onMouseUp={() => {
                  setStore("selected", option)
                  props.onSelect(option)
                }}
              >
                <text fg={option === store.selected ? selectedForeground(theme, theme.warning) : theme.textMuted}>
                  {props.options[option]}
                </text>
              </box>
            )}
          </For>
        </box>
        <box flexDirection="row" gap={2} flexShrink={0}>
          <Show when={props.fullscreen}>
            <ShortcutHint shortcut="ctrl+f" label={hint()} onTrigger={toggle} />
          </Show>
          <ShortcutHint shortcut="⇆" label="select" onTrigger={() => cycle(1)} />
          <ShortcutHint shortcut="enter" label="confirm" onTrigger={() => props.onSelect(store.selected)} />
        </box>
      </box>
    </box>
  )

  return (
    <Show when={!store.expanded} fallback={<Portal>{content()}</Portal>}>
      {content()}
    </Show>
  )
}
