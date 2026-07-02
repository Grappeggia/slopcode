import { ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useClipboard } from "../context/clipboard"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { useBindings } from "../keymap"
import { errorMessage } from "../util/error"
import { useDialog } from "../ui/dialog"
import { useToast } from "../ui/toast"

type SideEvent =
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done" }

export function DialogSideQuestion(props: {
  sessionID: string
  question: string
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
}) {
  const sdk = useSDK()
  const dialog = useDialog()
  const clipboard = useClipboard()
  const toast = useToast()
  const { theme } = useTheme()
  const [store, setStore] = createStore({
    answer: "",
    error: undefined as string | undefined,
    loading: true,
  })
  let scroll: ScrollBoxRenderable | undefined
  let controller: AbortController | undefined

  const bottom = () => setTimeout(() => scroll?.scrollTo(scroll.scrollHeight), 0)
  const close = () => dialog.clear()
  const copy = () => {
    if (!store.answer || !clipboard.write) return
    void clipboard.write(store.answer).then(
      () => toast.show({ message: "Side answer copied to clipboard", variant: "info" }),
      (error) => toast.error(error),
    )
  }

  useBindings(() => ({
    bindings: [
      { key: "return", desc: "Close side question", group: "Dialog", cmd: close },
      { key: "space", desc: "Close side question", group: "Dialog", cmd: close },
      { key: "up", desc: "Scroll side answer up", group: "Dialog", cmd: () => scroll?.scrollBy(-1) },
      { key: "down", desc: "Scroll side answer down", group: "Dialog", cmd: () => scroll?.scrollBy(1) },
      { key: "c", desc: "Copy side answer", group: "Dialog", cmd: copy },
    ],
  }))

  onMount(() => {
    const ctrl = new AbortController()
    controller = ctrl
    void (async () => {
      const result = await sdk.client.session.sideQuestion(
        {
          sessionID: props.sessionID,
          question: props.question,
          agent: props.agent,
          model: props.model,
          variant: props.variant,
        },
        { signal: ctrl.signal, sseMaxRetryAttempts: 0 },
      )

      for await (const event of result.stream as AsyncGenerator<SideEvent>) {
        if (ctrl.signal.aborted) return
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
        }
      }
    })()
      .catch((error) => {
        if (ctrl.signal.aborted) return
        setStore("error", errorMessage(error))
      })
      .finally(() => {
        setStore("loading", false)
      })
  })

  onCleanup(() => controller?.abort())

  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Side question
        </text>
        <text fg={theme.textMuted} onMouseUp={close}>
          enter/esc
        </text>
      </box>
      <box border={["left"]} borderColor={theme.border} paddingLeft={1}>
        <text fg={theme.textMuted} wrapMode="word">
          {props.question}
        </text>
      </box>
      <scrollbox ref={(r: ScrollBoxRenderable) => (scroll = r)} height={12} scrollbarOptions={{ visible: false }}>
        <Show when={store.answer} fallback={<text fg={theme.textMuted}>Thinking...</text>}>
          <text fg={theme.text} wrapMode="word">
            {store.answer}
          </text>
        </Show>
        <Show when={store.error}>
          <box marginTop={1}>
            <text fg={theme.error} wrapMode="word">
              {store.error}
            </text>
          </box>
        </Show>
      </scrollbox>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.textMuted}>{store.loading ? "streaming" : "complete"}</text>
        <text fg={theme.textMuted}>c copy | up/down scroll</text>
      </box>
    </box>
  )
}
