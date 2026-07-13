import { ScrollBoxRenderable, TextareaRenderable, TextAttributes } from "@opentui/core"
import type { SessionSideQuestionEvent, SessionSideQuestionTurn } from "@slopcode-ai/sdk/v2"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useClipboard } from "../context/clipboard"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { useBindings } from "../keymap"
import { errorMessage } from "../util/error"
import { density, isDense } from "../util/density"
import { useToast } from "../ui/toast"

const INACTIVITY_TIMEOUT = 30_000

export function SideQuestion(props: {
  sessionID: string
  question?: string
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
  focused?: boolean
  inactivityTimeout?: number
  onClose: () => void
}) {
  const sdk = useSDK()
  const clipboard = useClipboard()
  const toast = useToast()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const dense = () => isDense(density(dimensions()))
  const [store, setStore] = createStore<{
    turns: SessionSideQuestionTurn[]
    question?: string
    answer: string
    error?: string
    loading: boolean
    started: boolean
    used: number
    status?: Extract<SessionSideQuestionEvent, { type: "status" }>
    read?: Extract<SessionSideQuestionEvent, { type: "read" }>
    usage?: Extract<SessionSideQuestionEvent, { type: "usage" }>
  }>({
    turns: [],
    answer: "",
    loading: false,
    started: false,
    used: 0,
  })
  const [inputTarget, setInputTarget] = createSignal<TextareaRenderable>()
  let input: TextareaRenderable
  let scroll: ScrollBoxRenderable | undefined
  let controller: AbortController | undefined

  const bottom = () => setTimeout(() => scroll?.scrollTo(scroll.scrollHeight), 0)
  const files = () => store.used
  const copyable = () => (store.loading && store.answer ? store.answer : store.turns.at(-1)?.answer)
  const copy = () => {
    const answer = copyable()
    if (!answer || !clipboard.write) return
    void clipboard.write(answer).then(
      () => toast.show({ message: "Side answer copied to clipboard", variant: "info" }),
      (error) => toast.error(error),
    )
  }

  function ask() {
    if (store.loading) return
    const question = input.plainText.trim()
    if (!question) return

    controller?.abort()
    const ctrl = new AbortController()
    controller = ctrl
    const turns = store.turns.map((turn) => ({ question: turn.question, answer: turn.answer }))
    setStore({
      question,
      answer: "",
      error: undefined,
      loading: true,
      started: true,
      used: 0,
      status: undefined,
      read: undefined,
      usage: undefined,
    })

    let timeout: ReturnType<typeof setTimeout> | undefined
    let answer = ""
    let done = false
    const activity = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (ctrl.signal.aborted) return
        setStore("error", "Side question timed out due to inactivity. Press enter to retry.")
        setStore("loading", false)
        ctrl.abort()
      }, props.inactivityTimeout ?? INACTIVITY_TIMEOUT)
    }
    ctrl.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true })
    activity()

    void (async () => {
      const result = await sdk.client.session.sideQuestion(
        {
          sessionID: props.sessionID,
          question,
          turns: turns.length ? turns : undefined,
          agent: props.agent,
          model: props.model,
          variant: props.variant,
        },
        { signal: ctrl.signal, sseMaxRetryAttempts: 0 },
      )

      for await (const event of result.stream) {
        if (ctrl.signal.aborted) return
        if (event.type === "status") {
          activity()
          setStore("status", event)
          bottom()
        }
        if (event.type === "read") {
          activity()
          setStore("read", event)
          setStore("used", (used) => Math.max(used, event.files))
          bottom()
        }
        if (event.type === "usage") {
          setStore("usage", event)
          setStore("used", (used) => Math.max(used, event.files))
          bottom()
        }
        if (event.type === "text") {
          activity()
          answer += event.text
          setStore("answer", answer)
          bottom()
        }
        if (event.type === "error") {
          setStore("error", event.message)
          setStore("loading", false)
          ctrl.abort()
          return
        }
        if (event.type === "done") {
          done = true
          clearTimeout(timeout)
          setStore("loading", false)
          if (!answer.trim()) {
            setStore("error", "Side question completed without an answer. Press enter to retry.")
            return
          }
          setStore("turns", (items) => [...items, { question, answer }])
          setStore({ question: undefined, answer: "", status: undefined, read: undefined, usage: undefined, used: 0 })
          input.setText("")
          setTimeout(() => {
            if (props.focused === false || input.isDestroyed) return
            input.focus()
            input.gotoBufferEnd()
          }, 0)
          bottom()
          return
        }
      }
      if (done || ctrl.signal.aborted) return
      setStore("error", "Side question stream ended before done. Press enter to retry.")
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
      { key: "ctrl+c", desc: "Copy side answer", group: "Dialog", cmd: copy },
    ].filter(
      (binding) =>
        binding.key === "escape" ||
        ((binding.key === "up" || binding.key === "down") && store.started) ||
        (binding.key === "ctrl+c" && Boolean(copyable())),
    ),
  }))

  createEffect(() => {
    const target = inputTarget()
    if (!target || target.isDestroyed) return
    target.traits = store.loading ? { suspend: true, status: "BUSY" } : {}
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
        textColor={store.loading ? theme.textMuted : theme.text}
        focusedTextColor={store.loading ? theme.textMuted : theme.text}
        onSubmit={() => {
          if (store.error) setStore("error", undefined)
          ask()
        }}
      />
      <Show when={store.started}>
        <scrollbox ref={(r: ScrollBoxRenderable) => (scroll = r)} height={8} scrollbarOptions={{ visible: false }}>
          <For each={store.turns}>
            {(turn) => (
              <>
                <text fg={theme.textMuted} wrapMode="word">
                  You: {turn.question}
                </text>
                <text fg={theme.text} wrapMode="word">
                  Side: {turn.answer}
                </text>
              </>
            )}
          </For>
          <Show when={store.question}>
            {(question) => (
              <text fg={theme.textMuted} wrapMode="word">
                You: {question()}
              </text>
            )}
          </Show>
          <Show when={store.loading && !store.answer}>
            <text fg={theme.textMuted}>{store.status?.status === "reading" ? "Reading..." : "Thinking..."}</text>
          </Show>
          <Show when={store.answer}>
            <text fg={theme.text} wrapMode="word">
              Side: {store.answer}
            </text>
          </Show>
          <Show when={store.read}>
            {(read) => (
              <text fg={theme.textMuted} wrapMode="word">
                read {read().reference ? `${read().reference}:${read().path}` : read().path} at {read().offset} |{" "}
                {read().lines} lines | {files()}/5 files
              </text>
            )}
          </Show>
          <Show when={store.usage}>
            {(usage) => (
              <text fg={theme.textMuted} wrapMode="word">
                {usage().rounds} {usage().rounds === 1 ? "round" : "rounds"} | {usage().calls} reads | {usage().lines}{" "}
                lines | {usage().bytes} bytes | {files()}/5 files
              </text>
            )}
          </Show>
          <Show when={store.usage}>
            {(usage) => (
              <text fg={theme.textMuted} wrapMode="word">
                {usage().inputTokens} input tokens | {usage().outputTokens} output tokens
              </text>
            )}
          </Show>
          <Show when={store.error}>
            <text fg={theme.error} wrapMode="word">
              {store.error}
            </text>
          </Show>
        </scrollbox>
      </Show>
      <box flexDirection={dense() ? "column" : "row"} justifyContent="space-between">
        <text fg={theme.textMuted}>
          {store.loading
            ? `${store.status?.status ?? "generating"}${store.status ? ` round ${store.status.round}` : ""} | ${files()}/5 files`
            : store.error
              ? `failed | ${files()}/5 files`
              : `enter ask | ${files()}/5 files`}
        </text>
        <Show when={store.started}>
          <text fg={theme.textMuted}>{copyable() ? "ctrl+c copy | " : ""}up/down scroll</text>
        </Show>
      </box>
    </box>
  )
}
