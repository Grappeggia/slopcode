import { createMemo } from "solid-js"
import { Keybind } from "@/util/keybind"
import { pipe, mapValues } from "remeda"
import type { TuiConfig } from "@/config/tui"
import { Config } from "@/config/config"
import type { ParsedKey, Renderable } from "@opentui/core"
import { createStore } from "solid-js/store"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { createSimpleContext } from "./helper"
import { useTuiConfig } from "./tui-config"

export type KeybindKey = keyof NonNullable<TuiConfig.Info["keybinds"]> & string

export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const config = useTuiConfig()
    const keybinds = createMemo<Record<string, Keybind.Info[]>>(() => {
      return pipe(
        Config.Keybinds.parse(config.keybinds ?? {}) as Record<string, string>,
        mapValues((value) => Keybind.parse(value)),
      )
    })
    const [store, setStore] = createStore({
      leader: false,
      suspended: 0,
    })
    const renderer = useRenderer()

    let focus: Renderable | null
    let timeout: NodeJS.Timeout
    let keep = false

    function refresh() {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (!store.leader) return
        leader(false)
      }, 2000)
    }

    function leader(active: boolean) {
      if (active) {
        setStore("leader", true)
        keep = false
        focus = renderer.currentFocusedRenderable
        focus?.blur()
        refresh()
        return
      }

      if (!active) {
        keep = false
        if (timeout) clearTimeout(timeout)
        if (focus && !renderer.currentFocusedRenderable) {
          focus.focus()
        }
        setStore("leader", false)
      }
    }

    useKeyboard(async (evt) => {
      if (store.suspended > 0) return
      if (!store.leader && result.match("leader", evt)) {
        leader(true)
        return
      }

      if (store.leader && evt.name) {
        setImmediate(() => {
          const next = Keybind.nextLeader({ active: store.leader, name: evt.name, keep })
          keep = false
          if (next) {
            refresh()
            return
          }
          leader(false)
        })
      }
    })

    const result = {
      get all() {
        return keybinds()
      },
      get leader() {
        return store.leader
      },
      keep() {
        if (!store.leader) return
        keep = true
      },
      suspend() {
        if (store.leader) leader(false)
        setStore("suspended", (value) => value + 1)
        return () => setStore("suspended", (value) => Math.max(0, value - 1))
      },
      parse(evt: ParsedKey): Keybind.Info {
        // Handle special case for Ctrl+Underscore (represented as \x1F)
        if (evt.name === "\x1F") {
          return Keybind.fromParsedKey({ ...evt, name: "_", ctrl: true }, store.leader)
        }
        return Keybind.fromParsedKey(evt, store.leader)
      },
      match(key: string, evt: ParsedKey) {
        const list = keybinds()[key] ?? Keybind.parse(key)
        if (!list.length) return false
        const parsed: Keybind.Info = result.parse(evt)
        for (const item of list) {
          if (Keybind.match(item, parsed)) return true
        }
        return false
      },
      print(key: string) {
        const first = keybinds()[key]?.at(0) ?? Keybind.parse(key).at(0)
        if (!first) return ""
        const text = Keybind.toString(first)
        const lead = keybinds().leader?.[0]
        if (!lead) return text
        return text.replace("<leader>", Keybind.toString(lead))
      },
    }
    return result
  },
})
