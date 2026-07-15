import { RGBA, RenderableEvents, type TextareaRenderable } from "@opentui/core"
import { Grapheme } from "@slopcode-ai/core/util/grapheme"
import type { ConfigAutocompleteV1 } from "@slopcode-ai/core/v1/config/autocomplete"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import { useBindings } from "../../keymap"
import { createGhostLifecycle, ghostEligible, ghostLayout, ghostRemainder } from "../../prompt/ghost"

export type PromptGhostRef = {
  readonly text: string
  schedule(): void
  clear(): void
}

export function insertGhost(input: TextareaRenderable, value: string) {
  input.gotoBufferEnd()
  input.insertText(value)
}

export function PromptGhost(props: {
  input: () => TextareaRenderable | undefined
  settings: ConfigAutocompleteV1.Resolved
  sessionID?: string
  model?: { providerID: string; modelID: string }
  mode: "normal" | "shell"
  parts: number
  popover: boolean
  active: boolean
  maxRows: number
  revision: number
  color: RGBA | string
  complete(input: {
    sessionID: string
    model: { providerID: string; modelID: string }
    prefix: string
    signal: AbortSignal
  }): Promise<string | undefined>
  onAccept(value: string): void
  ref?: (ref: PromptGhostRef | undefined) => void
}) {
  const [ghost, setGhost] = createSignal("")
  const [focused, setFocused] = createSignal(false)
  const lifecycle = createGhostLifecycle()
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer) clearTimeout(timer)
    timer = undefined
    lifecycle.clear()
    setGhost("")
  }

  function eligible(prefix = props.input()?.plainText ?? "") {
    return ghostEligible({
      enabled: props.settings.enabled && !!props.sessionID && !!props.model && props.active,
      prefix,
      min: props.settings.min_prefix_chars,
      mode: props.mode,
      focused: focused(),
      cursor: props.input()?.cursorOffset ?? 0,
      popover: props.popover,
      parts: props.parts,
    })
  }

  function schedule() {
    clear()
    const input = props.input()
    const sessionID = props.sessionID
    const model = props.model
    if (!input || !sessionID || !model || !eligible()) return
    const prefix = input.plainText

    timer = setTimeout(async () => {
      timer = undefined
      if (!eligible(prefix) || props.input()?.plainText !== prefix) return
      const request = lifecycle.begin()
      const completion = await props
        .complete({
          sessionID,
          model,
          prefix: Grapheme.takeEnd(prefix, props.settings.max_prefix_chars),
          signal: request.signal,
        })
        .catch(() => undefined)
      if (completion === undefined || !lifecycle.current(request.generation)) return
      const current = props.model
      if (
        props.sessionID !== sessionID ||
        current?.providerID !== model.providerID ||
        current.modelID !== model.modelID ||
        props.input()?.plainText !== prefix ||
        !eligible(prefix)
      )
        return
      setGhost(ghostRemainder(prefix, completion))
    }, props.settings.debounce_ms)
  }

  createEffect(() => {
    const input = props.input()
    if (!input) return
    const focus = () => setFocused(true)
    const blur = () => {
      setFocused(false)
      clear()
    }
    setFocused(input.focused)
    input.on(RenderableEvents.FOCUSED, focus)
    input.on(RenderableEvents.BLURRED, blur)
    onCleanup(() => {
      input.off(RenderableEvents.FOCUSED, focus)
      input.off(RenderableEvents.BLURRED, blur)
    })
  })

  createEffect(
    on(
      () => [
        props.sessionID,
        props.model?.providerID,
        props.model?.modelID,
        props.settings.enabled,
        props.mode,
        props.parts,
        props.popover,
        props.active,
      ],
      clear,
      { defer: true },
    ),
  )

  const layout = createMemo(() => {
    props.revision
    const input = props.input()
    if (!ghost() || !input || input.width <= 0) return []
    return ghostLayout({
      ghost: ghost(),
      row: input.visualCursor.visualRow,
      col: input.visualCursor.visualCol,
      width: input.width,
      rows: Math.max(input.height, props.maxRows),
    })
  })
  const text = createMemo(() =>
    layout()
      .map((line) => line.text)
      .join(""),
  )
  const lines = createMemo(() => {
    const input = props.input()
    if (!input) return []
    const parent = input.parent
    return layout().map((line) => ({
      ...line,
      top: line.top + input.y - (parent?.y ?? input.y),
      left: line.left + input.x - (parent?.x ?? input.x),
    }))
  })
  const overflow = createMemo(() => {
    const input = props.input()
    const last = layout().at(-1)
    if (!input || !last) return 0
    return Math.max(0, last.top + 1 - input.height)
  })

  function accept() {
    const value = text()
    if (!value) return
    clear()
    props.onAccept(value)
  }

  useBindings(() => ({
    target: props.input,
    enabled: () => !!text() && !props.popover,
    bindings: [
      { key: "tab", desc: "Accept ghost completion", group: "Prompt", cmd: accept },
      { key: "escape", desc: "Dismiss ghost completion", group: "Prompt", cmd: clear },
    ],
  }))

  onMount(() => {
    props.ref?.({
      get text() {
        return text()
      },
      schedule,
      clear,
    })
  })

  onCleanup(() => {
    clear()
    props.ref?.(undefined)
  })

  return (
    <>
      <For each={lines()}>
        {(line) => (
          <text position="absolute" top={line.top} left={line.left} zIndex={1} fg={props.color} wrapMode="none">
            {line.text}
          </text>
        )}
      </For>
      <Show when={overflow()}>{(height) => <box height={height()} flexShrink={0} />}</Show>
    </>
  )
}
