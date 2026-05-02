import type { TuiPluginApi, TuiSlotContext, TuiSlotPlugin, TuiSlotProps } from "@slopcode-ai/plugin/tui"
import type { JSX } from "@opentui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"

type HostSlotPlugin = TuiSlotPlugin & {
  id: string
}

type SlotRecord = Record<
  string,
  ((ctx: TuiSlotContext, props: Record<string, unknown>) => JSX.Element | null) | undefined
>
export type HostPluginApi = TuiPluginApi
export type HostSlots = {
  register(plugin: HostSlotPlugin): () => void
}

const [plugins, setPlugins] = createSignal<HostSlotPlugin[]>([])
let context: TuiSlotContext | undefined

function ordered(name: string) {
  return plugins()
    .filter((plugin) => typeof (plugin.slots as SlotRecord)[name] === "function")
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function render(plugin: HostSlotPlugin, props: TuiSlotProps<string>) {
  if (!context) return null
  const fn = (plugin.slots as SlotRecord)[props.name]
  if (!fn) return null
  return fn(context, props as Record<string, unknown>)
}

export function Slot<Name extends string>(props: TuiSlotProps<Name>) {
  const list = createMemo(() => ordered(props.name))
  const winner = createMemo(() => list().at(-1))

  return (
    <Show
      when={props.mode === "single_winner"}
      fallback={
        <Show
          when={props.mode === "replace"}
          fallback={
            <>
              <Show when={props.mode === "prepend"}>
                <For each={list()}>{(plugin) => render(plugin, props as TuiSlotProps<string>)}</For>
              </Show>
              {props.children}
              <Show when={props.mode !== "prepend"}>
                <For each={list()}>{(plugin) => render(plugin, props as TuiSlotProps<string>)}</For>
              </Show>
            </>
          }
        >
          <For each={list()}>{(plugin) => render(plugin, props as TuiSlotProps<string>)}</For>
          <Show when={list().length === 0}>{props.children}</Show>
        </Show>
      }
    >
      <Show when={winner()} fallback={props.children}>
        {(plugin) => render(plugin(), props as TuiSlotProps<string>)}
      </Show>
    </Show>
  ) as JSX.Element
}

export function setupSlots(api: HostPluginApi): HostSlots {
  context = {
    theme: api.theme,
  }
  return {
    register(plugin) {
      setPlugins((list) => [...list, plugin])
      return () => setPlugins((list) => list.filter((item) => item !== plugin))
    },
  }
}

export function resetSlots() {
  setPlugins([])
  context = undefined
}
