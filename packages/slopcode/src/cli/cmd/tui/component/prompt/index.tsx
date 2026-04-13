import { BoxRenderable, TextareaRenderable, MouseEvent, PasteEvent } from "@opentui/core"
import {
  createEffect,
  createMemo,
  type JSX,
  onMount,
  createSignal,
  onCleanup,
  on,
  Show,
  Switch,
  Match,
  untrack,
} from "solid-js"
import "opentui-spinner/solid"
import path from "path"
import { Filesystem } from "@/util/filesystem"
import { useLocal } from "@tui/context/local"
import { useTheme } from "@tui/context/theme"
import { useSessionTabs } from "@tui/context/session-tabs"
import { useTabState } from "@tui/context/tab-state"
import { EmptyBorder } from "@tui/component/border"
import { useSDK } from "@tui/context/sdk"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { sessionWaiting } from "@tui/context/session-tabs-state"
import { Identifier } from "@/id/id"
import { createStore, produce, unwrap } from "solid-js/store"
import { useKeybind } from "@tui/context/keybind"
import { usePromptHistory, type PromptInfo } from "./history"
import { ghostCursor, ghostVisible, ghostRemainder } from "./ghost.ts"
import { usePromptStash } from "./stash"
import { DialogStash } from "../dialog-stash"
import { type AutocompleteRef, Autocomplete } from "./autocomplete"
import { useCommandDialog } from "../dialog-command"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Editor } from "@tui/util/editor"
import { useExit } from "../../context/exit"
import { Clipboard } from "../../util/clipboard"
import type { FilePart, Message } from "@slopcode-ai/sdk/v2"
import { TuiEvent } from "../../event"
import { iife } from "@/util/iife"
import { Locale } from "@/util/locale"
import { formatDuration } from "@/util/format"
import { createBlockSpinner } from "../../ui/spinner.ts"
import { useDialog } from "@tui/ui/dialog"
import { DialogProvider as DialogProviderConnect } from "../dialog-provider"
import { DialogAlert } from "../../ui/dialog-alert"
import { useToast } from "../../ui/toast"
import { useKV } from "../../context/kv"
import { useTextareaKeybindings } from "../textarea-keybindings"
import { DialogSkill } from "../dialog-skill"
import { describePromptQueue, promptQueue } from "./queue"
import * as TokenLimit from "./token-limit"

export type PromptProps = {
  sessionID?: string
  visible?: boolean
  disabled?: boolean
  historyMode?: boolean
  historyTarget?: "prompt" | "timeline"
  showHistoryHint?: boolean
  onSubmit?: () => void
  onFocus?: () => void
  ref?: (ref: PromptRef) => void
  hint?: JSX.Element
  showPlaceholder?: boolean
}

export type PromptRef = {
  focused: boolean
  current: PromptInfo
  set(prompt: PromptInfo): void
  reset(): void
  blur(): void
  focus(): void
  submit(): void
}

const PLACEHOLDERS = ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"]
const SHELL_PLACEHOLDERS = ["ls -la", "git status", "pwd"]

type QueueStore = {
  message: {
    [sessionID: string]: Message[] | undefined
  }
  session_status: {
    [sessionID: string]: { type: string } | undefined
  }
}

const idle = (store: QueueStore, sessionID: string) => (store.session_status[sessionID]?.type ?? "idle") === "idle"

const assistants = (messages: Message[], messageID: string) =>
  messages.filter((item) => item.role === "assistant" && item.parentID === messageID)

const finished = (message: Message) => {
  if (message.role !== "assistant") return false
  if (!message.time.completed) return false
  if (message.error) return message.error.name !== "MessageAbortedError"
  if (!message.finish) return false
  return !["tool-calls", "unknown"].includes(message.finish)
}

const done = (store: QueueStore, sessionID: string, messageID: string) => {
  if (!idle(store, sessionID)) return false
  return assistants(store.message[sessionID] ?? [], messageID).some(finished)
}

export function Prompt(props: PromptProps) {
  let input: TextareaRenderable
  let anchor: BoxRenderable
  let autocomplete: AutocompleteRef

  const keybind = useKeybind()
  const local = useLocal()
  const sdk = useSDK()
  const route = useRoute()
  const tabs = useSessionTabs()
  const tabState = useTabState()
  const sync = useSync()
  const dialog = useDialog()
  const toast = useToast()
  const status = createMemo(() => sync.data.session_status?.[props.sessionID ?? ""] ?? { type: "idle" })
  const waiting = createMemo(() =>
    sessionWaiting({
      sessionID: props.sessionID,
      sessions: sync.data.session,
      permission: sync.data.permission,
      question: sync.data.question,
    }),
  )
  const [now, setNow] = createSignal(Date.now())

  createEffect(() => {
    if (!waiting() && status().type === "idle") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => {
      clearInterval(timer)
    })
  })

  const busyText = createMemo(() => {
    const current = status()
    if (current.type !== "busy") return
    const elapsed = formatDuration(Math.max(0, Math.round((now() - current.since) / 1000))) || "0s"
    if (current.phase === "compacting") return `compacting ${elapsed}`
    if (current.phase === "running")
      return `${now() - current.since >= 15_000 ? "still running..." : "running"} ${elapsed}`
    return `${now() - current.since >= 15_000 ? "still starting..." : "starting"} ${elapsed}`
  })
  const history = usePromptHistory()
  const historyScope = createMemo(() => ({
    dir: sync.data.path.directory || process.cwd(),
    sessionID: props.sessionID,
  }))
  const stash = usePromptStash()
  const command = useCommandDialog()
  const renderer = useRenderer()
  const { theme, syntax } = useTheme()
  const kv = useKV()

  function promptModelWarning() {
    toast.show({
      variant: "warning",
      message: "Connect a provider to send prompts",
      duration: 3000,
    })
    if (sync.data.provider.length === 0) {
      dialog.replace(() => <DialogProviderConnect />)
    }
  }

  const abort = (error: unknown) => {
    return (
      (error instanceof DOMException && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error.name === "AbortError" || error.name === "MessageAbortedError"))
    )
  }

  const runSafe = (promise: Promise<unknown>) => {
    void promise.catch((error) => {
      if (abort(error)) return
      console.error("Prompt request failed", error)
    })
  }

  const textareaKeybindings = useTextareaKeybindings()

  const fileStyleId = syntax().getStyleId("extmark.file")!
  const agentStyleId = syntax().getStyleId("extmark.agent")!
  const pasteStyleId = syntax().getStyleId("extmark.paste")!
  let promptPartTypeId = 0

  sdk.event.on(TuiEvent.PromptAppend.type, (evt) => {
    if (!input || input.isDestroyed) return
    input.insertText(evt.properties.text)
    setTimeout(() => {
      // setTimeout is a workaround and needs to be addressed properly
      if (!input || input.isDestroyed) return
      input.getLayoutNode().markDirty()
      input.gotoBufferEnd()
      renderer.requestRender()
    }, 0)
  })

  createEffect(() => {
    if (props.disabled) {
      input.cursorColor = theme.backgroundElement
      return
    }

    if (props.historyMode && props.historyTarget === "timeline") {
      input.cursorColor = theme.backgroundElement
      return
    }

    input.cursorColor = theme.text
  })

  const currentTabID = createMemo(() => tabState.currentID())
  const currentTab = createMemo(() => tabState.get(currentTabID()))

  const [store, setStore] = createStore<{
    prompt: PromptInfo
    mode: "normal" | "shell"
    extmarkToPartIndex: Map<number, number>
    interrupt: number
    placeholder: number
    ghost: string
  }>({
    placeholder: Math.floor(Math.random() * PLACEHOLDERS.length),
    prompt: {
      input: "",
      parts: [],
    },
    mode: "normal",
    extmarkToPartIndex: new Map(),
    interrupt: 0,
    ghost: "",
  })
  const [cursor, setCursor] = createSignal({
    row: 0,
    col: 0,
    offset: 0,
  })

  function syncCursor() {
    if (!input || input.isDestroyed) return
    const visual = input.visualCursor
    setCursor({
      row: visual.visualRow,
      col: visual.visualCol,
      offset: visual.offset,
    })
  }

  function loadPrompt(prompt: PromptInfo) {
    if (!input || input.isDestroyed) return
    const next = unwrap(prompt)
    input.setText(next.input)
    setStore("prompt", {
      input: next.input,
      parts: structuredClone(next.parts),
    })
    setStore("mode", next.mode ?? "normal")
    restoreExtmarksFromParts(next.parts)
    input.gotoBufferEnd()
    syncCursor()
  }

  const ghostPoint = createMemo(() => ghostCursor(input, cursor()))

  const inlineGhost = createMemo(() => {
    if (
      !ghostVisible({
        ghost: store.ghost,
        mode: store.mode,
        disabled: props.disabled,
        historyMode: props.historyMode,
        historyTarget: props.historyTarget,
        autocompleteVisible: !!autocomplete?.visible,
        focused: !!input?.focused,
        cursorOffset: ghostPoint().offset,
        inputLength: store.prompt.input.length,
      })
    ) {
      return ""
    }

    return store.ghost
  })

  const inlineGhostPosition = createMemo(() => {
    const point = ghostPoint()
    return {
      top: point.row,
      left: point.col,
    }
  })

  createEffect(
    on(
      () => props.sessionID,
      () => {
        setStore("placeholder", Math.floor(Math.random() * PLACEHOLDERS.length))
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    const id = currentTabID()
    const next = currentTab().prompt
    if (!id || !input || input.isDestroyed) return
    const mode = next.mode ?? "normal"
    const current = untrack(() => ({
      input: store.prompt.input,
      parts: store.prompt.parts,
      mode: store.mode,
    }))
    if (current.input === next.input && Bun.deepEquals(current.parts, next.parts) && current.mode === mode) return
    loadPrompt(next)
  })

  createEffect(() => {
    const id = currentTabID()
    if (!id || !input || input.isDestroyed) return
    tabState.setPrompt(id, {
      input: store.prompt.input,
      parts: store.prompt.parts,
      mode: store.mode,
    })
  })

  command.register(() => {
    return [
      {
        title: "Clear prompt",
        value: "prompt.clear",
        category: "Prompt",
        hidden: true,
        onSelect: (dialog) => {
          input.extmarks.clear()
          input.clear()
          setStore("prompt", { input: "", parts: [] })
          setStore("mode", "normal")
          setStore("extmarkToPartIndex", new Map())
          dialog.clear()
        },
      },
      {
        title: "Submit prompt",
        value: "prompt.submit",
        keybind: "input_submit",
        category: "Prompt",
        hidden: true,
        onSelect: (dialog) => {
          if (!input.focused) return
          submit()
          dialog.clear()
        },
      },
      {
        title: "Paste",
        value: "prompt.paste",
        keybind: "input_paste",
        category: "Prompt",
        hidden: true,
        onSelect: async () => {
          const content = await Clipboard.read()
          if (content?.mime.startsWith("image/")) {
            await pasteImage({
              filename: "clipboard",
              mime: content.mime,
              content: content.data,
            })
          }
        },
      },
      {
        title: "Interrupt session",
        value: "session.interrupt",
        keybind: "session_interrupt",
        category: "Session",
        hidden: true,
        enabled: status().type !== "idle",
        onSelect: (dialog) => {
          if (autocomplete.visible) return
          // TODO: this should be its own command
          if (store.mode === "shell") {
            setStore("mode", "normal")
            return
          }
          if (!props.sessionID) return

          setStore("interrupt", store.interrupt + 1)

          setTimeout(() => {
            setStore("interrupt", 0)
          }, 5000)

          if (store.interrupt >= 2) {
            const paused = promptQueue.pause(props.sessionID)
            runSafe(
              sdk.client.session
                .pause({
                  sessionID: props.sessionID,
                })
                .then((result: { data?: boolean }) => {
                  if (result.data) return
                  if (paused) promptQueue.resume(props.sessionID!)
                })
                .catch((error: unknown) => {
                  if (paused) promptQueue.resume(props.sessionID!)
                  throw error
                }),
            )
            setStore("interrupt", 0)
          }
          dialog.clear()
        },
      },
      {
        title: "Open editor",
        category: "Session",
        keybind: "editor_open",
        value: "prompt.editor",
        slash: {
          name: "editor",
        },
        onSelect: async (dialog) => {
          dialog.clear()

          // replace summarized text parts with the actual text
          const text = store.prompt.parts
            .filter((p) => p.type === "text")
            .reduce((acc, p) => {
              if (!p.source) return acc
              return acc.replace(p.source.text.value, p.text)
            }, store.prompt.input)

          const nonTextParts = store.prompt.parts.filter((p) => p.type !== "text")

          const value = text
          const content = await Editor.open({ value, renderer })
          if (!content) return

          input.setText(content)

          // Update positions for nonTextParts based on their location in new content
          // Filter out parts whose virtual text was deleted
          // this handles a case where the user edits the text in the editor
          // such that the virtual text moves around or is deleted
          const updatedNonTextParts = nonTextParts
            .map((part) => {
              let virtualText = ""
              if (part.type === "file" && part.source?.text) {
                virtualText = part.source.text.value
              } else if (part.type === "agent" && part.source) {
                virtualText = part.source.value
              }

              if (!virtualText) return part

              const newStart = content.indexOf(virtualText)
              // if the virtual text is deleted, remove the part
              if (newStart === -1) return null

              const newEnd = newStart + virtualText.length

              if (part.type === "file" && part.source?.text) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    text: {
                      ...part.source.text,
                      start: newStart,
                      end: newEnd,
                    },
                  },
                }
              }

              if (part.type === "agent" && part.source) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    start: newStart,
                    end: newEnd,
                  },
                }
              }

              return part
            })
            .filter((part) => part !== null)

          setStore("prompt", {
            input: content,
            // keep only the non-text parts because the text parts were
            // already expanded inline
            parts: updatedNonTextParts,
          })
          restoreExtmarksFromParts(updatedNonTextParts)
          input.cursorOffset = Bun.stringWidth(content)
        },
      },
      {
        title: "Skills",
        value: "prompt.skills",
        category: "Prompt",
        slash: {
          name: "skills",
        },
        onSelect: () => {
          dialog.replace(() => (
            <DialogSkill
              onSelect={(skill) => {
                input.setText(`/${skill} `)
                setStore("prompt", {
                  input: `/${skill} `,
                  parts: [],
                })
                input.gotoBufferEnd()
              }}
            />
          ))
        },
      },
    ]
  })

  const ref: PromptRef = {
    get focused() {
      return input.focused
    },
    get current() {
      return {
        ...store.prompt,
        mode: store.mode,
      }
    },
    focus() {
      input.focus()
    },
    blur() {
      input.blur()
    },
    set(prompt) {
      loadPrompt(prompt)
    },
    reset() {
      input.clear()
      input.extmarks.clear()
      setStore("prompt", {
        input: "",
        parts: [],
      })
      setStore("mode", "normal")
      setStore("extmarkToPartIndex", new Map())
    },
    submit() {
      submit()
    },
  }

  createEffect(() => {
    if (props.visible !== false) input?.focus()
    if (props.visible === false) input?.blur()
  })

  function restoreExtmarksFromParts(parts: PromptInfo["parts"]) {
    input.extmarks.clear()
    setStore("extmarkToPartIndex", new Map())

    parts.forEach((part, partIndex) => {
      let start = 0
      let end = 0
      let virtualText = ""
      let styleId: number | undefined

      if (part.type === "file" && part.source?.text) {
        start = part.source.text.start
        end = part.source.text.end
        virtualText = part.source.text.value
        styleId = fileStyleId
      } else if (part.type === "agent" && part.source) {
        start = part.source.start
        end = part.source.end
        virtualText = part.source.value
        styleId = agentStyleId
      } else if (part.type === "text" && part.source?.text) {
        start = part.source.text.start
        end = part.source.text.end
        virtualText = part.source.text.value
        styleId = pasteStyleId
      }

      if (virtualText) {
        const extmarkId = input.extmarks.create({
          start,
          end,
          virtual: true,
          styleId,
          typeId: promptPartTypeId,
        })
        setStore("extmarkToPartIndex", (map: Map<number, number>) => {
          const newMap = new Map(map)
          newMap.set(extmarkId, partIndex)
          return newMap
        })
      }
    })
  }

  function syncExtmarksWithPromptParts() {
    const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId)
    setStore(
      produce((draft) => {
        const newMap = new Map<number, number>()
        const newParts: typeof draft.prompt.parts = []

        for (const extmark of allExtmarks) {
          const partIndex = draft.extmarkToPartIndex.get(extmark.id)
          if (partIndex !== undefined) {
            const part = draft.prompt.parts[partIndex]
            if (part) {
              if (part.type === "agent" && part.source) {
                part.source.start = extmark.start
                part.source.end = extmark.end
              } else if (part.type === "file" && part.source?.text) {
                part.source.text.start = extmark.start
                part.source.text.end = extmark.end
              } else if (part.type === "text" && part.source?.text) {
                part.source.text.start = extmark.start
                part.source.text.end = extmark.end
              }
              newMap.set(extmark.id, newParts.length)
              newParts.push(part)
            }
          }
        }

        draft.extmarkToPartIndex = newMap
        draft.prompt.parts = newParts
      }),
    )
  }

  let ghostTimer: Timer | undefined
  let ghostRequest = 0
  const [ghostSuggestion, setGhostSuggestion] = createSignal("")

  function clearGhost() {
    ghostRequest += 1
    if (ghostTimer) {
      clearTimeout(ghostTimer)
      ghostTimer = undefined
    }
    if (ghostSuggestion()) setGhostSuggestion("")
    if (store.ghost) setStore("ghost", "")
  }

  function acceptGhost() {
    if (!store.ghost) return false
    input.insertText(store.ghost)
    clearGhost()
    return true
  }

  createEffect(() => {
    const config = sync.data.config.autocomplete
    if (config?.enabled === false) {
      clearGhost()
      return
    }

    const sessionID = props.sessionID
    if (!sessionID || store.mode !== "normal") {
      clearGhost()
      return
    }

    if (autocomplete?.visible || !input?.focused) {
      clearGhost()
      return
    }

    const text = store.prompt.input
    const cursor = input.cursorOffset
    if (!text || cursor !== text.length) {
      clearGhost()
      return
    }

    if (!/\S/.test(text)) {
      clearGhost()
      return
    }

    if (store.prompt.parts.some((part) => part.type !== "text")) {
      clearGhost()
      return
    }

    const suggestion = ghostSuggestion()
    if (suggestion) {
      const remaining = ghostRemainder(text, suggestion)
      if (remaining !== undefined) {
        if (store.ghost !== remaining) setStore("ghost", remaining)
        if (!remaining) setGhostSuggestion("")
        return
      }
      setGhostSuggestion("")
      if (store.ghost) setStore("ghost", "")
    }

    const prefix = text
    if (prefix.length < (config?.min_prefix_chars ?? 12)) {
      clearGhost()
      return
    }

    if (ghostTimer) clearTimeout(ghostTimer)
    const requestID = ++ghostRequest
    ghostTimer = setTimeout(async () => {
      const selected = local.model.current()
      if (!selected) return
      const response = await sdk.client.session
        .autocomplete({
          sessionID,
          model: selected,
          agent: local.agent.current().name,
          variant: local.model.variant.current(),
          mode: "normal",
          prefix,
        })
        .catch(() => undefined)
      if (!response?.data) return
      if (requestID !== ghostRequest) return
      const completion = response.data.completion
      if (!completion || /\n/.test(completion)) {
        setGhostSuggestion("")
        if (store.ghost) setStore("ghost", "")
        return
      }
      setGhostSuggestion(prefix + completion)
      setStore("ghost", completion)
    }, config?.debounce_ms ?? 180)
  })

  onCleanup(() => {
    if (ghostTimer) clearTimeout(ghostTimer)
  })

  command.register(() => [
    {
      title: "Stash prompt",
      value: "prompt.stash",
      category: "Prompt",
      enabled: !!store.prompt.input,
      onSelect: (dialog) => {
        if (!store.prompt.input) return
        stash.push({
          input: store.prompt.input,
          parts: store.prompt.parts,
        })
        input.extmarks.clear()
        input.clear()
        setStore("prompt", { input: "", parts: [] })
        setStore("mode", "normal")
        setStore("extmarkToPartIndex", new Map())
        dialog.clear()
      },
    },
    {
      title: "Stash pop",
      value: "prompt.stash.pop",
      category: "Prompt",
      enabled: stash.list().length > 0,
      onSelect: (dialog) => {
        const entry = stash.pop()
        if (entry) {
          loadPrompt(entry)
        }
        dialog.clear()
      },
    },
    {
      title: "Stash list",
      value: "prompt.stash.list",
      category: "Prompt",
      enabled: stash.list().length > 0,
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogStash
            onSelect={(entry) => {
              loadPrompt(entry)
            }}
          />
        ))
      },
    },
  ])

  async function submit() {
    if (props.disabled) return
    clearGhost()
    if (autocomplete?.visible) return
    const trimmed = store.prompt.input.trim()
    if (props.sessionID && !trimmed) {
      const paused = promptQueue.snapshot(props.sessionID).paused
      if (paused) {
        promptQueue.resume(props.sessionID)
        runSafe(
          sdk.client.session
            .resume({
              sessionID: props.sessionID,
            })
            .then((result: { data?: boolean }) => {
              if (result.data) return
              promptQueue.pause(props.sessionID!)
            }),
        )
        props.onSubmit?.()
        return
      }
    }
    if (!trimmed) return
    if (trimmed === "exit" || trimmed === "quit" || trimmed === ":q") {
      exit()
      return
    }
    const selectedModel = local.model.current()
    if (!selectedModel) {
      promptModelWarning()
      return
    }
    const draft = !props.sessionID && tabs.draftActive()
    const sourceTabID = currentTabID()
    const sessionID = props.sessionID
      ? props.sessionID
      : await (async () => {
          const sessionID = await sdk.client.session.create({}).then((x) => x.data!.id)
          return sessionID
        })()
    const messageID = Identifier.ascending("message")
    let inputText = store.prompt.input
    const queueMode = sync.data.config.queue_mode ?? "serial"

    // Expand pasted text inline before submitting
    const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId)
    const sortedExtmarks = allExtmarks.sort((a: { start: number }, b: { start: number }) => b.start - a.start)

    for (const extmark of sortedExtmarks) {
      const partIndex = store.extmarkToPartIndex.get(extmark.id)
      if (partIndex !== undefined) {
        const part = store.prompt.parts[partIndex]
        if (part?.type === "text" && part.text) {
          const before = inputText.slice(0, extmark.start)
          const after = inputText.slice(extmark.end)
          inputText = before + part.text + after
        }
      }
    }

    // Filter out text parts (pasted content) since they're now expanded inline
    const nonTextParts = store.prompt.parts.filter((part) => part.type !== "text")

    // Capture mode before it gets reset
    const currentMode = store.mode
    const agent = local.agent.current().name
    const variant = local.model.variant.current()

    if (store.mode === "shell") {
      runSafe(
        sdk.client.session.shell({
          sessionID,
          agent,
          model: {
            providerID: selectedModel.providerID,
            modelID: selectedModel.modelID,
          },
          command: inputText,
        }),
      )
      setStore("mode", "normal")
    } else if (
      inputText.startsWith("/") &&
      iife(() => {
        const firstLine = inputText.split("\n")[0]
        const command = firstLine.split(" ")[0].slice(1)
        return sync.data.command.some((x) => x.name === command)
      })
    ) {
      // Parse command from first line, preserve multi-line content in arguments
      const firstLineEnd = inputText.indexOf("\n")
      const firstLine = firstLineEnd === -1 ? inputText : inputText.slice(0, firstLineEnd)
      const [command, ...firstLineArgs] = firstLine.split(" ")
      const restOfInput = firstLineEnd === -1 ? "" : inputText.slice(firstLineEnd + 1)
      const args = firstLineArgs.join(" ") + (restOfInput ? "\n" + restOfInput : "")

      runSafe(
        sdk.client.session.command({
          sessionID,
          command: command.slice(1),
          arguments: args,
          agent,
          model: `${selectedModel.providerID}/${selectedModel.modelID}`,
          messageID,
          variant,
          parts: nonTextParts
            .filter((x) => x.type === "file")
            .map((x) => ({
              id: Identifier.ascending("part"),
              ...x,
            })),
        }),
      )
    } else {
      const paused = queueMode === "serial" ? promptQueue.snapshot(sessionID).paused : undefined
      const time = { queued: Date.now(), started: undefined as number | undefined }
      const send = async () => {
        time.started ??= Date.now()
        await sdk.client.session.promptAsync({
          sessionID,
          ...selectedModel,
          messageID,
          front: queueMode === "serial" && !!paused,
          agent,
          model: selectedModel,
          variant,
          parts: [
            {
              id: Identifier.ascending("part"),
              type: "text",
              text: inputText,
            },
            ...nonTextParts.map((x) => ({
              id: Identifier.ascending("part"),
              ...x,
            })),
          ],
        })
      }

      if (queueMode === "serial") {
        const queued = describePromptQueue({
          text: inputText,
          files: nonTextParts.length,
        })
        const item = {
          key: sessionID,
          id: messageID,
          mode: store.mode,
          agent,
          summary: queued.summary,
          detail: queued.detail,
          time,
          ready: () => idle(sync.data as QueueStore, sessionID) && !promptQueue.snapshot(sessionID).paused,
          done: () => done(sync.data as QueueStore, sessionID, messageID),
          run: send,
          reject: (error: unknown) => {
            if (abort(error)) return
            if (paused) promptQueue.setPaused(paused)
            console.error("Prompt request failed", error)
          },
        }
        if (paused) {
          promptQueue.clearPaused(sessionID)
          promptQueue.unshift(item)
        }
        if (!paused) {
          promptQueue.push(item)
        }
      } else {
        runSafe(send())
      }
    }
    history.append(
      {
        ...historyScope(),
        sessionID,
      },
      {
        ...store.prompt,
        mode: currentMode,
      },
    )
    if (!props.sessionID) {
      tabState.copySelection(sourceTabID, sessionID)
    }
    input.extmarks.clear()
    setStore("prompt", {
      input: "",
      parts: [],
    })
    setStore("mode", "normal")
    setStore("extmarkToPartIndex", new Map())
    props.onSubmit?.()

    // temporary hack to make sure the message is sent
    if (!props.sessionID)
      setTimeout(() => {
        if (draft) {
          tabs.promoteDraft(sessionID)
          route.navigate({
            type: "session",
            sessionID,
            source: "switch",
            workspaceID: route.data.workspaceID,
          })
          return
        }
        route.navigate({
          type: "session",
          sessionID,
          source: "new",
          workspaceID: route.data.workspaceID,
        })
      }, 50)
    input.clear()
  }
  const exit = useExit()

  function pasteText(text: string, virtualText: string) {
    const currentOffset = input.visualCursor.offset
    const extmarkStart = currentOffset
    const extmarkEnd = extmarkStart + virtualText.length

    input.insertText(virtualText + " ")

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: pasteStyleId,
      typeId: promptPartTypeId,
    })

    setStore(
      produce((draft) => {
        const partIndex = draft.prompt.parts.length
        draft.prompt.parts.push({
          type: "text" as const,
          text,
          source: {
            text: {
              start: extmarkStart,
              end: extmarkEnd,
              value: virtualText,
            },
          },
        })
        draft.extmarkToPartIndex.set(extmarkId, partIndex)
      }),
    )
  }

  async function pasteImage(file: { filename?: string; content: string; mime: string }) {
    const currentOffset = input.visualCursor.offset
    const extmarkStart = currentOffset
    const count = store.prompt.parts.filter((x) => x.type === "file" && x.mime.startsWith("image/")).length
    const virtualText = `[Image ${count + 1}]`
    const extmarkEnd = extmarkStart + virtualText.length
    const textToInsert = virtualText + " "

    input.insertText(textToInsert)

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: pasteStyleId,
      typeId: promptPartTypeId,
    })

    const part: Omit<FilePart, "id" | "messageID" | "sessionID"> = {
      type: "file" as const,
      mime: file.mime,
      filename: file.filename,
      url: `data:${file.mime};base64,${file.content}`,
      source: {
        type: "file",
        path: file.filename ?? "",
        text: {
          start: extmarkStart,
          end: extmarkEnd,
          value: virtualText,
        },
      },
    }
    setStore(
      produce((draft) => {
        const partIndex = draft.prompt.parts.length
        draft.prompt.parts.push(part)
        draft.extmarkToPartIndex.set(extmarkId, partIndex)
      }),
    )
    return
  }

  const highlight = createMemo(() => {
    if (props.historyMode && props.historyTarget === "timeline") return theme.backgroundElement
    if (keybind.leader) return theme.border
    if (store.mode === "shell") return theme.primary
    return local.agent.color(local.agent.current().name)
  })

  const showVariant = createMemo(() => {
    const variants = local.model.variant.list()
    if (variants.length === 0) return false
    const current = local.model.variant.current()
    return !!current
  })
  const tokenLimit = createMemo(() =>
    TokenLimit.label(
      TokenLimit.consumed({
        messages: props.sessionID ? (sync.data.message[props.sessionID] ?? []) : [],
        parts: sync.data.part,
        model: local.model.current(),
      }),
    ),
  )

  const placeholderText = createMemo(() => {
    if (props.sessionID) {
      if (promptQueue.snapshot(props.sessionID).paused) {
        return "Press enter to resume, or type a prompt to inject it ahead of the queue"
      }
      return undefined
    }
    if (store.mode === "shell") {
      const example = SHELL_PLACEHOLDERS[store.placeholder % SHELL_PLACEHOLDERS.length]
      return `Run a command... "${example}"`
    }
    return `Ask anything... "${PLACEHOLDERS[store.placeholder % PLACEHOLDERS.length]}"`
  })
  const dimensions = useTerminalDimensions()
  const compact = createMemo(() => dimensions().width < 100)
  const tight = createMemo(() => dimensions().width < 80)
  const tiny = createMemo(() => dimensions().width < 72)
  const statusWidth = createMemo(() => {
    if (!waiting() && status().type === "idle") return undefined
    if (!compact()) return undefined
    return Math.max(20, Math.floor(dimensions().width / 2) - 4)
  })
  const chipGap = createMemo(() => (tight() ? 0 : compact() ? 1 : 2))
  const chipPad = createMemo(() => (compact() ? 0 : 1))
  const showVariantHint = createMemo(() => !compact())
  const showAgentHint = createMemo(() => !tight())
  const showHistoryChip = createMemo(() => props.showHistoryHint !== false && history.has(historyScope()) && !tiny())
  const showCommandChip = createMemo(() => !tiny())
  const label = (full: string, short: string = full, hideOnTight = false) => {
    if (tight() && hideOnTight) return ""
    if (compact()) return short
    return full
  }
  const muted = (full: string, short: string = full, hideOnTight = false) => {
    const text = label(full, short, hideOnTight)
    if (!text) return ""
    return <span style={{ fg: theme.textMuted }}> {text}</span>
  }
  const busyLabel = createMemo(() => {
    const text = busyText()
    if (!text) return
    if (tight()) return Locale.truncate(text, 18)
    if (compact()) return Locale.truncate(text, 24)
    return text
  })

  const spinnerDef = createMemo(() => {
    const color = local.agent.color(local.agent.current().name)
    return createBlockSpinner({ color })
  })

  const [hover, setHover] = createSignal<string>()
  const [flash, setFlash] = createSignal<string>()
  let pulse: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => {
    if (!pulse) return
    clearTimeout(pulse)
  })

  const run = (id: string, fn: () => void) => {
    setFlash(id)
    if (pulse) clearTimeout(pulse)
    pulse = setTimeout(() => {
      setFlash(undefined)
    }, 140)
    fn()
  }

  const chip = (id: string) => {
    if (flash() === id) return theme.backgroundMenu
    if (hover() === id) return theme.backgroundElement
    return undefined
  }
  const hint = (id: string, fn: () => void, body: JSX.Element) => {
    return (
      <box
        paddingLeft={chipPad()}
        paddingRight={chipPad()}
        flexShrink={0}
        onMouseDown={() => input?.focus()}
        onMouseOver={() => setHover(id)}
        onMouseOut={() => setHover(undefined)}
        onMouseUp={() => run(id, fn)}
        backgroundColor={chip(id)}
      >
        {body}
      </box>
    )
  }

  return (
    <>
      <Autocomplete
        sessionID={props.sessionID}
        ref={(r) => (autocomplete = r)}
        anchor={() => anchor}
        input={() => input}
        setPrompt={(cb) => {
          setStore("prompt", produce(cb))
        }}
        setExtmark={(partIndex, extmarkId) => {
          setStore("extmarkToPartIndex", (map: Map<number, number>) => {
            const newMap = new Map(map)
            newMap.set(extmarkId, partIndex)
            return newMap
          })
        }}
        value={store.prompt.input}
        fileStyleId={fileStyleId}
        agentStyleId={agentStyleId}
        promptPartTypeId={() => promptPartTypeId}
      />
      <box ref={(r) => (anchor = r)} visible={props.visible !== false}>
        <box
          border={["left"]}
          borderColor={highlight()}
          customBorderChars={{
            ...EmptyBorder,
            vertical: "┃",
            bottomLeft: "╹",
          }}
        >
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            flexShrink={0}
            backgroundColor={theme.backgroundElement}
            flexGrow={1}
          >
            <box position="relative">
              <textarea
                placeholder={placeholderText()}
                textColor={keybind.leader ? theme.textMuted : theme.text}
                focusedTextColor={keybind.leader ? theme.textMuted : theme.text}
                minHeight={1}
                maxHeight={6}
                onContentChange={() => {
                  const value = input.plainText
                  setStore("prompt", "input", value)
                  autocomplete.onInput(value)
                  syncExtmarksWithPromptParts()
                  syncCursor()
                }}
                onCursorChange={() => {
                  syncCursor()
                }}
                keyBindings={textareaKeybindings()}
                onKeyDown={async (e) => {
                  if (props.disabled) {
                    e.preventDefault()
                    return
                  }
                  // Handle clipboard paste (Ctrl+V) - check for images first on Windows
                  // This is needed because Windows terminal doesn't properly send image data
                  // through bracketed paste, so we need to intercept the keypress and
                  // directly read from clipboard before the terminal handles it
                  if (keybind.match("input_paste", e)) {
                    const content = await Clipboard.read()
                    if (content?.mime.startsWith("image/")) {
                      e.preventDefault()
                      await pasteImage({
                        filename: "clipboard",
                        mime: content.mime,
                        content: content.data,
                      })
                      return
                    }
                    // If no image, let the default paste behavior continue
                  }
                  if (keybind.match("input_clear", e) && store.prompt.input !== "") {
                    input.clear()
                    input.extmarks.clear()
                    setStore("prompt", {
                      input: "",
                      parts: [],
                    })
                    setStore("mode", "normal")
                    setStore("extmarkToPartIndex", new Map())
                    return
                  }
                  if (keybind.match("app_exit", e)) {
                    if (store.prompt.input === "") {
                      await exit()
                      // Don't preventDefault - let textarea potentially handle the event
                      e.preventDefault()
                      return
                    }
                  }
                  if (e.name === "!" && input.visualCursor.offset === 0) {
                    setStore("placeholder", Math.floor(Math.random() * SHELL_PLACEHOLDERS.length))
                    setStore("mode", "shell")
                    e.preventDefault()
                    return
                  }
                  if (store.mode === "shell") {
                    if ((e.name === "backspace" && input.visualCursor.offset === 0) || e.name === "escape") {
                      setStore("mode", "normal")
                      e.preventDefault()
                      return
                    }
                  }
                  if (store.mode === "normal" && !autocomplete.visible && store.ghost) {
                    if (
                      e.name === "right" &&
                      !e.ctrl &&
                      !e.meta &&
                      !e.option &&
                      !e.shift &&
                      input.cursorOffset === input.plainText.length
                    ) {
                      if (acceptGhost()) {
                        e.preventDefault()
                        return
                      }
                    }
                    if (e.name === "escape") {
                      clearGhost()
                      e.preventDefault()
                      return
                    }
                  }
                  if (store.mode === "normal") autocomplete.onKeyDown(e)
                  if (!autocomplete.visible) {
                    if (
                      !props.historyMode &&
                      ((keybind.match("history_previous", e) && input.cursorOffset === 0) ||
                        (keybind.match("history_next", e) && input.cursorOffset === input.plainText.length))
                    ) {
                      const direction = keybind.match("history_previous", e) ? -1 : 1
                      const item = history.move(historyScope(), direction, {
                        ...store.prompt,
                        mode: store.mode,
                      })

                      if (item) {
                        input.setText(item.input)
                        setStore("prompt", item)
                        setStore("mode", item.mode ?? "normal")
                        restoreExtmarksFromParts(item.parts)
                        e.preventDefault()
                        if (direction === -1) input.cursorOffset = 0
                        if (direction === 1) input.cursorOffset = input.plainText.length
                      }
                      return
                    }

                    if (keybind.match("history_previous", e) && input.visualCursor.visualRow === 0)
                      input.cursorOffset = 0
                    if (keybind.match("history_next", e) && input.visualCursor.visualRow === input.height - 1)
                      input.cursorOffset = input.plainText.length
                  }
                }}
                onSubmit={submit}
                onPaste={async (event: PasteEvent) => {
                  if (props.disabled) {
                    event.preventDefault()
                    return
                  }

                  // Normalize line endings at the boundary
                  // Windows ConPTY/Terminal often sends CR-only newlines in bracketed paste
                  // Replace CRLF first, then any remaining CR
                  const normalizedText = event.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
                  const pastedContent = normalizedText.trim()
                  if (!pastedContent) {
                    command.trigger("prompt.paste")
                    return
                  }

                  // trim ' from the beginning and end of the pasted content. just
                  // ' and nothing else
                  const filepath = pastedContent.replace(/^'+|'+$/g, "").replace(/\\ /g, " ")
                  const isUrl = /^(https?):\/\//.test(filepath)
                  if (!isUrl) {
                    try {
                      const mime = Filesystem.mimeType(filepath)
                      const filename = path.basename(filepath)
                      // Handle SVG as raw text content, not as base64 image
                      if (mime === "image/svg+xml") {
                        event.preventDefault()
                        const content = await Filesystem.readText(filepath).catch(() => {})
                        if (content) {
                          pasteText(content, `[SVG: ${filename ?? "image"}]`)
                          return
                        }
                      }
                      if (mime.startsWith("image/")) {
                        event.preventDefault()
                        const content = await Filesystem.readArrayBuffer(filepath)
                          .then((buffer) => Buffer.from(buffer).toString("base64"))
                          .catch(() => {})
                        if (content) {
                          await pasteImage({
                            filename,
                            mime,
                            content,
                          })
                          return
                        }
                      }
                    } catch {}
                  }

                  const lineCount = (pastedContent.match(/\n/g)?.length ?? 0) + 1
                  if (
                    (lineCount >= 3 || pastedContent.length > 150) &&
                    !sync.data.config.experimental?.disable_paste_summary
                  ) {
                    event.preventDefault()
                    pasteText(pastedContent, `[Pasted ~${lineCount} lines]`)
                    return
                  }

                  // Force layout update and render for the pasted content
                  setTimeout(() => {
                    // setTimeout is a workaround and needs to be addressed properly
                    if (!input || input.isDestroyed) return
                    input.getLayoutNode().markDirty()
                    renderer.requestRender()
                  }, 0)
                }}
                ref={(r: TextareaRenderable) => {
                  input = r
                  if (promptPartTypeId === 0) {
                    promptPartTypeId = input.extmarks.registerType("prompt-part")
                  }
                  loadPrompt(currentTab().prompt)
                  props.ref?.(ref)
                  syncCursor()
                  setTimeout(() => {
                    // setTimeout is a workaround and needs to be addressed properly
                    if (!input || input.isDestroyed) return
                    const hidden = props.disabled || (props.historyMode && props.historyTarget === "timeline")
                    input.cursorColor = hidden ? theme.backgroundElement : theme.text
                    syncCursor()
                  }, 0)
                }}
                onMouseDown={(r: MouseEvent) => {
                  props.onFocus?.()
                  r.target?.focus()
                }}
                focusedBackgroundColor={theme.backgroundElement}
                cursorColor={theme.text}
                syntaxStyle={syntax()}
              />
              <Show when={inlineGhost()}>
                {(ghost) => (
                  <box position="absolute" top={inlineGhostPosition().top} left={inlineGhostPosition().left} zIndex={1}>
                    <text fg={theme.textMuted}>{ghost()}</text>
                  </box>
                )}
              </Show>
            </box>
            <box flexDirection="row" flexShrink={0} gap={1} marginTop={1}>
              <text fg={highlight()}>
                {store.mode === "shell" ? "Shell" : Locale.titlecase(local.agent.current().name)}{" "}
              </text>
              <Show when={store.mode === "normal"}>
                <box flexDirection="row" gap={1}>
                  <text flexShrink={0} fg={keybind.leader ? theme.textMuted : theme.text}>
                    {local.model.parsed().model}
                  </text>
                  <text fg={theme.textMuted}>{local.model.parsed().provider}</text>
                  <Show when={showVariant()}>
                    <text fg={theme.textMuted}>·</text>
                    <text>
                      <span style={{ fg: theme.warning, bold: true }}>{local.model.variant.current()}</span>
                    </text>
                  </Show>
                  <Show when={tokenLimit()}>
                    {(value) => (
                      <>
                        <text fg={theme.textMuted}>·</text>
                        <text fg={theme.textMuted}>{value()}</text>
                      </>
                    )}
                  </Show>
                </box>
              </Show>
            </box>
          </box>
        </box>
        <box flexDirection="row" justifyContent="space-between" gap={chipGap()}>
          <Show when={waiting() || status().type !== "idle"} fallback={<text />}>
            <box
              flexDirection="row"
              gap={compact() ? 0 : 1}
              flexGrow={1}
              flexShrink={1}
              minWidth={0}
              maxWidth={statusWidth()}
              justifyContent="flex-start"
              alignItems="center"
            >
              <box flexShrink={0} flexDirection="row" gap={compact() ? 0 : 1} alignItems="center">
                <box marginLeft={compact() ? 0 : 1}>
                  <Show
                    when={waiting()}
                    fallback={
                      <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>[⋯]</text>}>
                        <spinner color={spinnerDef().color} frames={spinnerDef().frames} interval={80} />
                      </Show>
                    }
                  >
                    <text fg={theme.textMuted}>■</text>
                  </Show>
                </box>
                <box flexDirection="row" gap={compact() ? 0 : 1} flexShrink={1} minWidth={0}>
                  <Show when={waiting()}>
                    <text fg={theme.textMuted} wrapMode="none" overflow="hidden">
                      waiting for input
                    </text>
                  </Show>
                  <Show when={busyLabel()}>
                    <text fg={theme.textMuted} wrapMode="none" overflow="hidden">
                      {busyLabel()}
                    </text>
                  </Show>
                  {(() => {
                    const retry = createMemo(() => {
                      const s = status()
                      if (s.type !== "retry") return
                      return s
                    })
                    const message = createMemo(() => {
                      const r = retry()
                      if (!r) return
                      if (r.message.includes("exceeded your current quota") && r.message.includes("gemini"))
                        return "gemini is way too hot right now"
                      if (r.message.length > 80) return r.message.slice(0, 80) + "..."
                      return r.message
                    })
                    const isTruncated = createMemo(() => {
                      const r = retry()
                      if (!r) return false
                      return r.message.length > 120
                    })
                    const [seconds, setSeconds] = createSignal(0)
                    onMount(() => {
                      const timer = setInterval(() => {
                        const next = retry()?.next
                        if (next) setSeconds(Math.round((next - Date.now()) / 1000))
                      }, 1000)

                      onCleanup(() => {
                        clearInterval(timer)
                      })
                    })
                    const handleMessageClick = () => {
                      const r = retry()
                      if (!r) return
                      if (isTruncated()) {
                        DialogAlert.show(dialog, "Retry Error", r.message)
                      }
                    }

                    const retryText = () => {
                      const r = retry()
                      if (!r) return ""
                      const baseMessage = compact()
                        ? Locale.truncate(message() ?? "", tight() ? 18 : 28)
                        : (message() ?? "")
                      const truncatedHint = isTruncated() && !compact() ? " (click to expand)" : ""
                      const duration = formatDuration(seconds())
                      const retryInfo = compact()
                        ? ` [${duration ? `${duration} ` : ""}#${r.attempt}]`
                        : ` [retrying ${duration ? `in ${duration} ` : ""}attempt #${r.attempt}]`
                      return baseMessage + truncatedHint + retryInfo
                    }

                    return (
                      <Show when={retry()}>
                        <box onMouseUp={handleMessageClick}>
                          <text fg={theme.error} wrapMode="none">
                            {retryText()}
                          </text>
                        </box>
                      </Show>
                    )
                  })()}
                </box>
              </box>
            </box>
          </Show>
          <box gap={chipGap()} flexDirection="row" flexShrink={0}>
            <Show when={waiting() || status().type !== "idle"}>
              {hint(
                "interrupt",
                () => command.trigger("session.interrupt"),
                <text fg={store.interrupt > 0 ? theme.primary : theme.text} wrapMode="none">
                  {keybind.print("session_interrupt")}
                  <span style={{ fg: store.interrupt > 0 ? theme.primary : theme.textMuted }}>
                    {(() => {
                      const text =
                        store.interrupt > 0
                          ? label("again to interrupt", "again", true)
                          : label("interrupt", "stop", true)
                      return text ? ` ${text}` : ""
                    })()}
                  </span>
                </text>,
              )}
            </Show>
            <Show when={status().type !== "retry"}>
              <Switch>
                <Match when={props.historyMode}>
                  {hint(
                    "history-toggle",
                    () => command.trigger("session.history.toggle"),
                    <text fg={theme.text} wrapMode="none">
                      {keybind.print("history_mode_toggle")}
                      {muted("edit mode", "edit", true)}
                    </text>,
                  )}
                  <box flexDirection="row" alignItems="center" gap={compact() ? 0 : 1}>
                    <box
                      paddingLeft={chipPad()}
                      paddingRight={chipPad()}
                      onMouseDown={() => input?.focus()}
                      onMouseOver={() => setHover("history-previous")}
                      onMouseOut={() => setHover(undefined)}
                      onMouseUp={() => run("history-previous", () => command.trigger("session.history.previous"))}
                      backgroundColor={chip("history-previous")}
                    >
                      <text fg={theme.text}>↑</text>
                    </box>
                    <box
                      paddingLeft={chipPad()}
                      paddingRight={chipPad()}
                      onMouseDown={() => input?.focus()}
                      onMouseOver={() => setHover("history-next")}
                      onMouseOut={() => setHover(undefined)}
                      onMouseUp={() => run("history-next", () => command.trigger("session.history.next"))}
                      backgroundColor={chip("history-next")}
                    >
                      <text fg={theme.text}>↓</text>
                    </box>
                    <text fg={theme.textMuted} wrapMode="none">
                      {label("nav. prompt", "prompt", true)}
                    </text>
                  </box>
                  <box flexDirection="row" alignItems="center" gap={compact() ? 0 : 1}>
                    <box
                      paddingLeft={chipPad()}
                      paddingRight={chipPad()}
                      onMouseDown={() => input?.focus()}
                      onMouseOver={() => setHover("history-left")}
                      onMouseOut={() => setHover(undefined)}
                      onMouseUp={() => run("history-left", () => command.trigger("session.history.left"))}
                      backgroundColor={chip("history-left")}
                    >
                      <text fg={theme.text}>←</text>
                    </box>
                    <box
                      paddingLeft={chipPad()}
                      paddingRight={chipPad()}
                      onMouseDown={() => input?.focus()}
                      onMouseOver={() => setHover("history-right")}
                      onMouseOut={() => setHover(undefined)}
                      onMouseUp={() => run("history-right", () => command.trigger("session.history.right"))}
                      backgroundColor={chip("history-right")}
                    >
                      <text fg={theme.text}>→</text>
                    </box>
                    <text fg={theme.textMuted} wrapMode="none">
                      {label("nav. trace", "trace", true)}
                    </text>
                  </box>
                  <text fg={theme.text} wrapMode="none">
                    space
                    {muted("expand", "expand", true)}
                  </text>
                </Match>
                <Match when={store.mode === "normal"}>
                  <Show when={showVariantHint() && local.model.variant.list().length > 0}>
                    {hint(
                      "variant",
                      () => command.trigger("variant.cycle"),
                      <text fg={theme.text} wrapMode="none">
                        {keybind.print("variant_cycle")}
                        {muted("variants", "var", true)}
                      </text>,
                    )}
                  </Show>
                  <Show when={showAgentHint()}>
                    {hint(
                      "agent",
                      () => command.trigger("agent.cycle"),
                      <text fg={theme.text} wrapMode="none">
                        {keybind.print("agent_cycle")}
                        {muted("agents", "agent", true)}
                      </text>,
                    )}
                  </Show>
                  <Show when={showHistoryChip()}>
                    {hint(
                      "history",
                      () => command.trigger("session.history.toggle"),
                      <text fg={theme.text} wrapMode="none">
                        {keybind.print("history_mode_toggle")}
                        {muted("history", "hist", true)}
                      </text>,
                    )}
                  </Show>
                  <Show when={showCommandChip()}>
                    {hint(
                      "command",
                      () => command.show(),
                      <text fg={theme.text} wrapMode="none">
                        {keybind.print("command_list")}
                        {muted("commands", "cmd", true)}
                      </text>,
                    )}
                  </Show>
                </Match>
                <Match when={store.mode === "shell"}>
                  <text fg={theme.text} wrapMode="none">
                    esc
                    {muted("exit shell mode", "shell", true)}
                  </text>
                </Match>
              </Switch>
            </Show>
          </box>
        </box>
      </box>
    </>
  )
}
