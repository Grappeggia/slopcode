import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { MouseButton } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSDK } from "@tui/context/sdk"
import { useKeybind } from "@tui/context/keybind"
import { useDialog } from "@tui/ui/dialog"
import type { Snapshot } from "@/editor/types"

export type EditorInfo = {
  id: string
  file: string
  dirty: boolean
  diff: boolean
  mode: string
  status: string
}

const button = (value: number) => {
  if (value === MouseButton.RIGHT) return "right"
  if (value === MouseButton.MIDDLE) return "middle"
  return "left"
}

const modifier = (input: { shift?: boolean; alt?: boolean; ctrl?: boolean }) => {
  return [input.ctrl ? "C" : "", input.alt ? "A" : "", input.shift ? "S" : ""].join("")
}

const key = (evt: {
  name: string
  ctrl: boolean
  meta: boolean
  shift: boolean
  option: boolean
  sequence: string
  raw: string
  eventType: string
}) => {
  if (evt.eventType === "release") return
  if (!evt.ctrl && !evt.meta && !evt.option) {
    if (evt.name === "return") return "<CR>"
    if (evt.name === "backspace") return "<BS>"
    if (evt.name === "delete") return "<Del>"
    if (evt.name === "escape") return "<Esc>"
    if (evt.name === "tab") return evt.shift ? "<S-Tab>" : "<Tab>"
    if (evt.name === "up") return "<Up>"
    if (evt.name === "down") return "<Down>"
    if (evt.name === "left") return "<Left>"
    if (evt.name === "right") return "<Right>"
    if (evt.name === "pageup") return "<PageUp>"
    if (evt.name === "pagedown") return "<PageDown>"
    if (evt.name === "home") return "<Home>"
    if (evt.name === "end") return "<End>"
    if (evt.name === "space") return " "
    if (evt.sequence) return evt.sequence === "<" ? "<LT>" : evt.sequence
  }
  const mods = [evt.ctrl ? "C" : "", evt.meta || evt.option ? "M" : "", evt.shift ? "S" : ""].filter(Boolean)
  const name = (() => {
    if (evt.name === "return") return "CR"
    if (evt.name === "backspace") return "BS"
    if (evt.name === "delete") return "Del"
    if (evt.name === "escape") return "Esc"
    if (evt.name === "tab") return "Tab"
    if (evt.name === "up") return "Up"
    if (evt.name === "down") return "Down"
    if (evt.name === "left") return "Left"
    if (evt.name === "right") return "Right"
    if (evt.name === "pageup") return "PageUp"
    if (evt.name === "pagedown") return "PageDown"
    if (evt.name === "home") return "Home"
    if (evt.name === "end") return "End"
    if (evt.name === "space") return "Space"
    return evt.name.length === 1 ? evt.name : evt.raw
  })()
  if (!name) return
  return `<${mods.join("-")}${mods.length > 0 ? "-" : ""}${name}>`
}

function Action(props: { label: string; muted?: boolean; onSelect(): void }) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={(evt) => {
        evt.preventDefault()
        evt.stopPropagation()
        props.onSelect()
      }}
    >
      <text fg={props.muted ? theme.textMuted : theme.text}>{props.label}</text>
    </box>
  )
}

export function EditorPane(props: {
  sessionID: string
  info: () => EditorInfo | undefined
  onChange(info: Partial<EditorInfo>): void
  onRequestClose(): void
  onClosed(id: string): void
}) {
  const sdk = useSDK()
  const keybind = useKeybind()
  const dialog = useDialog()
  const { theme } = useTheme()
  const dims = useTerminalDimensions()
  const [snapshot, setSnapshot] = createSignal<Snapshot>()
  const size = createMemo(() => ({ cols: Math.max(20, dims().width - 6), rows: Math.max(5, dims().height - 8) }))
  let ws: WebSocket | undefined

  const url = (input: string) => {
    const next = new URL(input, sdk.url)
    if (sdk.directory) next.searchParams.set("directory", sdk.directory)
    if (sdk.workspaceID) next.searchParams.set("workspace", sdk.workspaceID)
    if (sdk.viewID) next.searchParams.set("viewID", sdk.viewID)
    next.searchParams.set("sessionID", props.sessionID)
    return next
  }

  const headers = () => new Headers(sdk.headers)
  const daemonToken = () => headers().get("x-slopcode-daemon-token")

  const send = (value: Record<string, unknown>) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(value))
  }

  const request = async (method: string, input: string) => {
    const response = await (sdk.fetch ?? fetch)(url(input), {
      method,
      headers: headers(),
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }

  const save = async () => {
    const info = props.info()
    if (!info) return
    const next = (await request("POST", `/editor/${info.id}/save`)) as EditorInfo
    props.onChange(next)
  }

  const dismiss = async () => {
    const info = props.info()
    if (!info || !info.diff) return
    const next = (await request("POST", `/editor/${info.id}/diff/dismiss`)) as EditorInfo
    props.onChange(next)
  }

  onMount(() => {
    const resume = keybind.suspend()
    onCleanup(resume)
  })

  createEffect(
    on(
      () => props.info()?.id,
      (id) => {
        if (!id) return
        setSnapshot(undefined)
        const next = url(`/editor/${id}/connect`)
        next.protocol = next.protocol === "https:" ? "wss:" : "ws:"
        const token = daemonToken()
        if (token) next.searchParams.set("daemonToken", token)
        let disposed = false
        ws = new WebSocket(next)
        ws.onopen = () => {
          send({ type: "resize", rows: size().rows, cols: size().cols })
          send({ type: "focus", gained: true })
        }
        ws.onmessage = (event) => {
          const data = JSON.parse(String(event.data)) as { type: string; snapshot?: Snapshot }
          if (data.type !== "snapshot" || !data.snapshot) return
          setSnapshot(data.snapshot)
          props.onChange({
            file: data.snapshot.file,
            dirty: data.snapshot.dirty,
            diff: data.snapshot.diff,
            mode: data.snapshot.mode,
            status: data.snapshot.status,
          })
        }
        ws.onclose = () => {
          if (!disposed) props.onClosed(id)
        }
        onCleanup(() => {
          disposed = true
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "focus", gained: false }))
          ws?.close()
          ws = undefined
        })
      },
    ),
  )

  createEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    send({ type: "resize", rows: size().rows, cols: size().cols })
  })

  useKeyboard((evt) => {
    const info = props.info()
    if (!info || dialog.stack.length > 0) return
    if (evt.ctrl && evt.name === "s") {
      evt.preventDefault()
      void save()
      return
    }
    if (evt.ctrl && evt.name === "q") {
      evt.preventDefault()
      props.onRequestClose()
      return
    }
    if (evt.ctrl && evt.name === "d" && info.diff) {
      evt.preventDefault()
      void dismiss()
      return
    }
    const value = key(evt)
    if (!value) return
    evt.preventDefault()
    send({ type: "input", keys: value })
  })

  const mouse = (
    type: "press" | "release" | "drag" | "move" | "up" | "down",
    evt: {
      x: number
      y: number
      button: number
      modifiers: { shift: boolean; alt: boolean; ctrl: boolean }
      preventDefault(): void
      stopPropagation(): void
      isDragging?: boolean
    },
  ) => {
    if (dialog.stack.length > 0) return
    evt.preventDefault()
    evt.stopPropagation()
    if (type === "up" || type === "down") {
      send({ type: "mouse", button: "wheel", action: type, modifier: modifier(evt.modifiers), row: evt.y, col: evt.x })
      return
    }
    send({
      type: "mouse",
      button: button(evt.button),
      action: type,
      modifier: modifier(evt.modifiers),
      row: evt.y,
      col: evt.x,
    })
  }

  return (
    <box flexGrow={1} flexDirection="column" paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1}>
      <box
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
      >
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text fg={theme.text} wrapMode="none">
            <b>{props.info()?.file ?? snapshot()?.file ?? "Editor"}</b>
            <span style={{ fg: theme.textMuted }}> {snapshot()?.mode ?? props.info()?.mode ?? "EDIT"}</span>
            <Show when={props.info()?.dirty || snapshot()?.dirty}>
              <span style={{ fg: theme.warning }}> modified</span>
            </Show>
            <Show when={(snapshot()?.diagnostics?.length ?? 0) > 0}>
              <span style={{ fg: theme.error }}> {(snapshot()?.diagnostics?.length ?? 0).toString()} issues</span>
            </Show>
          </text>
          <box flexDirection="row" gap={1}>
            <Action label="Save ^S" muted={!(props.info()?.dirty || snapshot()?.dirty)} onSelect={() => void save()} />
            <Show when={props.info()?.diff || snapshot()?.diff}>
              <Action label="Dismiss Diff ^D" onSelect={() => void dismiss()} />
            </Show>
            <Action label="Back ^Q" onSelect={props.onRequestClose} />
          </box>
        </box>
      </box>
      <box
        flexGrow={1}
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={(evt) => mouse("press", evt)}
        onMouseUp={(evt) => mouse("release", evt)}
        onMouseMove={(evt) => mouse(evt.isDragging ? "drag" : "move", evt)}
        onMouseScroll={(evt) => mouse(evt.button === MouseButton.WHEEL_UP ? "up" : "down", evt)}
      >
        <box flexDirection="column" gap={0}>
          <For each={snapshot()?.rows ?? []}>
            {(row) => (
              <text wrapMode="none">
                <For each={row}>{(part) => <span style={part}>{part.text || " "}</span>}</For>
              </text>
            )}
          </For>
        </box>
      </box>
      <Show when={(snapshot()?.diagnostics?.length ?? 0) > 0}>
        <box flexDirection="column" gap={0}>
          <For each={snapshot()?.diagnostics?.slice(0, 3) ?? []}>
            {(item) => (
              <text fg={item.severity === "error" ? theme.error : theme.warning} wrapMode="none">
                {`L${item.line}:C${item.column} ${item.message}`}
              </text>
            )}
          </For>
        </box>
      </Show>
      <text fg={theme.textMuted}>
        Embedded SlopCode editor with built-in syntax colors and local linting. Toolbar shortcuts: ^S save, ^D dismiss
        diff, ^Q back.
      </text>
    </box>
  )
}
