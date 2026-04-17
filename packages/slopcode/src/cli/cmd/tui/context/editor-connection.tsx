import { createEffect, onCleanup, untrack } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { createSimpleContext } from "./helper"
import { useSDK } from "./sdk"
import { useTabState } from "./tab-state"
import type { EditorTab } from "./tab-state-store"
import type { Snapshot } from "@/editor/types"

type Connection = {
  editor_id: string
  session_id: string
  file: string
  snapshot?: Snapshot
  status: "idle" | "connecting" | "open" | "closed" | "error"
  rows: number
  cols: number
  focused: boolean
  retries: number
  error?: string
}

type Mouse = {
  type: string
  button: string
  modifier: string
  row: number
  col: number
}

const delay = (count: number) => Math.min(2_000, 250 * 2 ** Math.max(0, count))

export const { use: useEditorConnection, provider: EditorConnectionProvider } = createSimpleContext({
  name: "EditorConnection",
  init: () => {
    const sdk = useSDK()
    const tabs = useTabState()
    const [store, setStore] = createStore<Record<string, Connection>>({})
    const sockets = new Map<string, WebSocket>()
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const closing = new Set<string>()

    const endpoint = (input: string, sessionID: string) => {
      const next = new URL(input, sdk.url)
      if (sdk.directory) next.searchParams.set("directory", sdk.directory)
      if (sdk.workspaceID) next.searchParams.set("workspace", sdk.workspaceID)
      if (sdk.viewID) next.searchParams.set("viewID", sdk.viewID)
      next.searchParams.set("sessionID", sessionID)
      const token = new Headers(sdk.headers).get("x-slopcode-daemon-token")
      if (token) next.searchParams.set("daemonToken", token)
      return next
    }

    const request = async <T,>(method: string, input: string, sessionID: string, body?: unknown) => {
      const headers = new Headers(sdk.headers)
      if (body !== undefined) headers.set("content-type", "application/json")
      const response = await (sdk.fetch ?? fetch)(endpoint(input, sessionID), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await response.text())
      return (await response.json()) as T
    }

    const all = () => tabs.all() as Record<string, { editor: { tabs: EditorTab[] } }>

    const locate = (editorID: string) => {
      for (const [sessionID, state] of Object.entries(all())) {
        const tab = state.editor.tabs.find((item) => item.editorID === editorID)
        if (tab) return { sessionID, tab }
      }
    }

    const clearTimer = (editorID: string) => {
      const hit = timers.get(editorID)
      if (!hit) return
      clearTimeout(hit)
      timers.delete(editorID)
    }

    const patch = (editorID: string, patch: Partial<Connection>) => {
      if (!store[editorID]) return
      setStore(editorID, (item) => ({ ...item, ...patch }))
    }

    const sync = (editorID: string, snapshot: Snapshot) => {
      const hit = locate(editorID)
      if (!hit) return
      tabs.patchEditor(hit.sessionID, hit.tab.file, {
        dirty: snapshot.dirty,
        diff: snapshot.diff,
        mode: snapshot.mode,
        status: snapshot.status,
        snapshot,
      })
      patch(editorID, {
        snapshot,
        status: "open",
        error: undefined,
        retries: 0,
      })
    }

    const teardown = (editorID: string) => {
      clearTimer(editorID)
      closing.add(editorID)
      const ws = sockets.get(editorID)
      if (!ws) return
      sockets.delete(editorID)
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "focus", gained: false }))
      ws.close()
    }

    const connect = (editorID: string) => {
      const current = store[editorID]
      if (!current) return
      if (sockets.has(editorID)) return
      clearTimer(editorID)
      patch(editorID, { status: "connecting" })
      const ws = new WebSocket(endpoint(`/editor/${editorID}/connect`, current.session_id))
      sockets.set(editorID, ws)
      ws.onopen = () => {
        if (sockets.get(editorID) !== ws) return
        patch(editorID, { status: "open", error: undefined, retries: 0 })
        const next = store[editorID]
        if (!next) return
        ws.send(JSON.stringify({ type: "resize", rows: next.rows, cols: next.cols }))
        ws.send(JSON.stringify({ type: "focus", gained: next.focused }))
      }
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data)) as { type: string; snapshot?: Snapshot }
        if (data.type !== "snapshot" || !data.snapshot) return
        sync(editorID, data.snapshot)
      }
      ws.onerror = () => {
        patch(editorID, { status: "error", error: "socket error" })
      }
      ws.onclose = () => {
        if (sockets.get(editorID) === ws) sockets.delete(editorID)
        const next = store[editorID]
        if (!next) return
        if (closing.delete(editorID)) {
          patch(editorID, { status: "closed" })
          return
        }
        const hit = locate(editorID)
        if (!hit) {
          drop(editorID)
          return
        }
        const retries = next.retries + 1
        patch(editorID, { status: "closed", retries })
        const timer = setTimeout(() => connect(editorID), delay(retries))
        timers.set(editorID, timer)
      }
    }

    const ensure = (sessionID: string, tab: EditorTab, size?: { rows: number; cols: number }) => {
      const current = store[tab.editorID]
      if (!current) {
        setStore(tab.editorID, {
          editor_id: tab.editorID,
          session_id: sessionID,
          file: tab.file,
          snapshot: tab.snapshot,
          status: "idle",
          rows: size?.rows ?? 10,
          cols: size?.cols ?? 40,
          focused: false,
          retries: 0,
        })
      }
      if (current) {
        patch(tab.editorID, {
          session_id: sessionID,
          file: tab.file,
          snapshot: tab.snapshot ?? current.snapshot,
          rows: size?.rows ?? current.rows,
          cols: size?.cols ?? current.cols,
        })
      }
      connect(tab.editorID)
    }

    const drop = (editorID: string) => {
      setStore(
        produce((draft) => {
          delete draft[editorID]
        }),
      )
    }

    createEffect(() => {
      const open = new Set(
        Object.entries(all()).flatMap(([sessionID, state]) =>
          state.editor.tabs.map((tab) => {
            ensure(sessionID, tab)
            return tab.editorID
          }),
        ),
      )
      untrack(() => Object.keys(store)).forEach((editorID) => {
        if (open.has(editorID)) return
        teardown(editorID)
        drop(editorID)
      })
    })

    onCleanup(() => {
      Array.from(timers.values()).forEach((timer) => clearTimeout(timer))
      timers.clear()
      Array.from(sockets.keys()).forEach((editorID) => teardown(editorID))
    })

    return {
      get(editorID?: string) {
        if (!editorID) return
        return store[editorID]
      },
      snapshot(editorID?: string) {
        if (!editorID) return
        return store[editorID]?.snapshot
      },
      async open(input: { sessionID: string; file: string; rows: number; cols: number }) {
        const info = await request<{
          id: string
          file: string
          dirty: boolean
          diff: boolean
          mode: string
          status: string
        }>("POST", "/editor", input.sessionID, {
          sessionID: input.sessionID,
          file: input.file,
          size: { rows: input.rows, cols: input.cols },
        })
        const snapshot = await request<Snapshot>("GET", `/editor/${info.id}/snapshot`, input.sessionID)
        const tab: EditorTab = {
          file: input.file,
          editorID: info.id,
          dirty: info.dirty,
          diff: info.diff,
          mode: info.mode,
          status: info.status,
          snapshot,
        }
        tabs.setEditor(input.sessionID, tab)
        ensure(input.sessionID, tab, { rows: input.rows, cols: input.cols })
        return tab
      },
      async close(input: { sessionID: string; file: string }) {
        const tab = tabs.editor(input.sessionID).tabs.find((item) => item.file === input.file)
        if (!tab) return
        teardown(tab.editorID)
        await (sdk.fetch ?? fetch)(endpoint(`/editor/${tab.editorID}`, input.sessionID), {
          method: "DELETE",
          headers: new Headers(sdk.headers),
        }).catch(() => undefined)
        tabs.closeEditor(input.sessionID, input.file)
        drop(tab.editorID)
      },
      async save(input: { sessionID: string; editorID: string }) {
        const info = await request<{
          id: string
          file: string
          dirty: boolean
          diff: boolean
          mode: string
          status: string
        }>("POST", `/editor/${input.editorID}/save`, input.sessionID)
        const hit = locate(input.editorID)
        if (!hit) return info
        tabs.patchEditor(hit.sessionID, hit.tab.file, {
          dirty: info.dirty,
          diff: info.diff,
          mode: info.mode,
          status: info.status,
        })
        return info
      },
      async dismiss(input: { sessionID: string; editorID: string }) {
        const info = await request<{
          id: string
          file: string
          dirty: boolean
          diff: boolean
          mode: string
          status: string
        }>("POST", `/editor/${input.editorID}/diff/dismiss`, input.sessionID)
        const hit = locate(input.editorID)
        if (!hit) return info
        tabs.patchEditor(hit.sessionID, hit.tab.file, {
          dirty: info.dirty,
          diff: info.diff,
          mode: info.mode,
          status: info.status,
        })
        return info
      },
      ensure(input: { sessionID: string; tab: EditorTab; rows: number; cols: number }) {
        ensure(input.sessionID, input.tab, { rows: input.rows, cols: input.cols })
      },
      resize(editorID: string, size: { rows: number; cols: number }) {
        const hit = store[editorID]
        if (!hit) return
        patch(editorID, { rows: size.rows, cols: size.cols })
        const ws = sockets.get(editorID)
        if (ws?.readyState !== WebSocket.OPEN) return connect(editorID)
        ws.send(JSON.stringify({ type: "resize", rows: size.rows, cols: size.cols }))
      },
      focus(editorID: string, gained: boolean) {
        if (!store[editorID]) return
        patch(editorID, { focused: gained })
        const ws = sockets.get(editorID)
        if (ws?.readyState !== WebSocket.OPEN) return connect(editorID)
        ws.send(JSON.stringify({ type: "focus", gained }))
      },
      input(editorID: string, keys: string) {
        const ws = sockets.get(editorID)
        if (ws?.readyState !== WebSocket.OPEN) return connect(editorID)
        ws.send(JSON.stringify({ type: "input", keys }))
      },
      mouse(editorID: string, input: Mouse) {
        const ws = sockets.get(editorID)
        if (ws?.readyState !== WebSocket.OPEN) return connect(editorID)
        ws.send(JSON.stringify({
          type: "mouse",
          button: input.button,
          action: input.type,
          modifier: input.modifier,
          row: input.row,
          col: input.col,
        }))
      },
    }
  },
})
