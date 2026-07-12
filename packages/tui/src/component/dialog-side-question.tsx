import { ScrollBoxRenderable, TextareaRenderable, TextAttributes } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useClipboard } from "../context/clipboard"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { useBindings } from "../keymap"
import { errorMessage } from "../util/error"
import { useToast } from "../ui/toast"

type SideEvent = { type: "text"; text: string } | { type: "error"; message: string } | { type: "done" }

const FIRST_EVENT_TIMEOUT = 30_000

export function SideQuestion(props: {
  sessionID: string
  question?: string
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
  focused?: boolean
  onClose: () => void
}) {
  const sdk = useSDK()
  const clipboard = useClipboard()
  const toast = useToast()
  const { theme } = useTheme()
  const [store, setStore] = createStore({
    answer: "",
    error: undefined as string | undefined,
    loading: false,
    complete: false,
    started: false,
  })
  const [inputTarget, setInputTarget] = createSignal<TextareaRenderable>()
  let input: TextareaRenderable
  let scroll: ScrollBoxRenderable | undefined
  let controller: AbortController | undefined

  const bottom = () => setTimeout(() => scroll?.scrollTo(scroll.scrollHeight), 0)
  const copy = () => {
    if (!store.answer || !clipboard.write) return
    void clipboard.write(store.answer).then(
      () => toast.show({ message: "Side answer copied to clipboard", variant: "info" }),
      (error) => toast.error(error),
    )
  }

  function ask() {
    if (store.loading || store.complete) return
    const question = input.plainText.trim()
    if (!question) return

    controller?.abort()
    const ctrl = new AbortController()
    controller = ctrl
    setStore({ answer: "", error: undefined, loading: true, complete: false, started: true })

    let received = false
    const timeout = setTimeout(() => {
      if (received || ctrl.signal.aborted) return
      setStore("error", "Side question timed out before receiving a response. Press enter to retry.")
      setStore("loading", false)
      ctrl.abort()
    }, FIRST_EVENT_TIMEOUT)

    void (async () => {
      const result = await sdk.client.session.sideQuestion(
        {
          sessionID: props.sessionID,
          question,
          agent: props.agent,
          model: props.model,
          variant: props.variant,
        },
        { signal: ctrl.signal, sseMaxRetryAttempts: 0 },
      )

      for await (const event of result.stream as AsyncGenerator<SideEvent>) {
        if (ctrl.signal.aborted) return
        if (!received) {
          received = true
          clearTimeout(timeout)
        }
        if (event.type === "text") {
          setStore("answer", (text) => text + event.text)
          bottom()
        }
        if (event.type === "error") {
          setStore("error", event.message)
          setStore("loading", false)
        }
        if (event.type === "done") {
          setStore("loading", false)
          setStore("complete", !store.error)
        }
      }
    })()
      .catch((error) => {
        if (ctrl.signal.aborted) return
        setStore("error", errorMessage(error))
      })
      .finally(() => {
        clearTimeout(timeout)
        if (!ctrl.signal.aborted) setStore("loading", false)
      })
  }

  useBindings(() => ({
    target: inputTarget,
    bindings: [
      { key: "escape", desc: "Close side question", group: "Prompt", cmd: props.onClose },
      { key: "up", desc: "Scroll side answer up", group: "Dialog", cmd: () => scroll?.scrollBy(-1) },
      { key: "down", desc: "Scroll side answer down", group: "Dialog", cmd: () => scroll?.scrollBy(1) },
      { key: "c", desc: "Copy side answer", group: "Dialog", cmd: copy },
    ].filter((binding) => binding.key === "escape" || store.loading || store.complete),
  }))

  createEffect(() => {
    const target = inputTarget()
    if (!target || target.isDestroyed) return
    target.traits = store.loading || store.complete ? { suspend: true, status: "BUSY" } : {}
  })

  createEffect(() => {
    const target = inputTarget()
    if (!target || target.isDestroyed) return
    if (props.focused === false) {
      if (target.focused) target.blur()
      return
    }
    if (!target.focused) target.focus()
  })

  onMount(() => {
    input.gotoBufferEnd()
    if (props.question) ask()
  })

  onCleanup(() => controller?.abort())

  return (
    <>
      <box height={1} flexShrink={0} border={["top"]} borderColor={theme.accent} />
      <box border={["left"]} borderColor={theme.accent} paddingLeft={1} paddingRight={1} gap={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.text}>
            Side question
          </text>
          <text fg={theme.textMuted} onMouseUp={props.onClose}>
            esc close
          </text>
        </box>
        <textarea
          ref={(value: TextareaRenderable) => {
            input = value
            setInputTarget(value)
          }}
          initialValue={props.question}
          height={store.started ? 1 : 3}
          placeholder="Ask a question about the current session"
          placeholderColor={theme.textMuted}
          textColor={store.loading || store.complete ? theme.textMuted : theme.text}
          focusedTextColor={store.loading || store.complete ? theme.textMuted : theme.text}
          onSubmit={() => {
            if (store.error) setStore("error", undefined)
            ask()
          }}
        />
        <Show when={store.started}>
          <scrollbox ref={(r: ScrollBoxRenderable) => (scroll = r)} height={4} scrollbarOptions={{ visible: false }}>
            <Show when={store.answer} fallback={<text fg={theme.textMuted}>Thinking...</text>}>
              <text fg={theme.text} wrapMode="word">
                {store.answer}
              </text>
            </Show>
            <Show when={store.error}>
              <text fg={theme.error} wrapMode="word">
                {store.error}
              </text>
            </Show>
          </scrollbox>
        </Show>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>
            {store.loading ? "streaming" : store.complete ? "complete" : store.error ? "failed" : "enter ask"}
          </text>
          <Show when={store.started}>
            <text fg={theme.textMuted}>c copy | up/down scroll</text>
          </Show>
        </box>
      </box>
      <box height={1} flexShrink={0} border={["top"]} borderColor={theme.accent} />
    </>
  )
}
