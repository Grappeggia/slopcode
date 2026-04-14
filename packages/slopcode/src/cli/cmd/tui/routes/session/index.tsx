import {
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
  useContext,
} from "solid-js"
import { createStore } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import path from "path"
import { useRoute, useRouteData } from "@tui/context/route"
import { useSessionTabs } from "@tui/context/session-tabs"
import { useSync } from "@tui/context/sync"
import { SplitBorder } from "@tui/component/border"
import { Spinner } from "@tui/component/spinner"
import "@tui/component/diff-color"
import { selectedForeground, tint, useTheme } from "@tui/context/theme"
import {
  BoxRenderable,
  ScrollBoxRenderable,
  MacOSScrollAccel,
  type ScrollAcceleration,
  TextAttributes,
  RGBA,
} from "@opentui/core"
import { Prompt, type PromptRef } from "@tui/component/prompt"
import { promptQueue, type PromptQueueItem } from "@tui/component/prompt/queue"
import type { AssistantMessage, Part, ToolPart, UserMessage, TextPart, ReasoningPart } from "@slopcode-ai/sdk/v2"
import { useLocal } from "@tui/context/local"
import { Locale } from "@/util/locale"
import { formatDuration } from "@/util/format"
import type { Tool } from "@/tool/tool"
import type { ReadTool } from "@/tool/read"
import type { WriteTool } from "@/tool/write"
import { BashTool } from "@/tool/bash"
import type { GlobTool } from "@/tool/glob"
import { TodoWriteTool } from "@/tool/todo"
import type { GrepTool } from "@/tool/grep"
import type { ListTool } from "@/tool/ls"
import type { EditTool } from "@/tool/edit"
import type { ApplyPatchTool } from "@/tool/apply_patch"
import type { WebFetchTool } from "@/tool/webfetch"
import type { TaskTool } from "@/tool/task"
import type { QuestionTool } from "@/tool/question"
import type { SkillTool } from "@/tool/skill"
import { useKeyboard, useRenderer, useTerminalDimensions, type JSX } from "@opentui/solid"
import { useSDK } from "@tui/context/sdk"
import { useCommandDialog } from "@tui/component/dialog-command"
import type { DialogContext } from "@tui/ui/dialog"
import { useKeybind } from "@tui/context/keybind"
import { Header } from "./header"
import { SessionStrip } from "./session-strip"
import { adjacentTab, sessionWaiting } from "@tui/context/session-tabs-state"
import { parsePatch } from "diff"
import { useDialog } from "../../ui/dialog"
import { TodoItem } from "../../component/todo-item"
import { DialogMessage } from "./dialog-message"
import type { PromptInfo } from "../../component/prompt/history"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { DialogTimeline } from "./dialog-timeline"
import { DialogForkFromTimeline } from "./dialog-fork-from-timeline"
import { DialogSessionRename } from "../../component/dialog-session-rename"
import { Sidebar, type SidebarMode } from "./sidebar"
import { EditorPane, type EditorInfo } from "./editor-pane"
import { Flag } from "@/flag/flag"
import { LANGUAGE_EXTENSIONS } from "@/lsp/language"
import { Clipboard } from "../../util/clipboard"
import { Toast, useToast } from "../../ui/toast"
import { useKV } from "../../context/kv.tsx"
import { Editor } from "../../util/editor"
import stripAnsi from "strip-ansi"
import { Footer } from "./footer.tsx"
import { usePromptRef } from "../../context/prompt"
import { useExit } from "../../context/exit"
import { Filesystem } from "@/util/filesystem"
import { Global } from "@/global"
import { PermissionPrompt } from "./permission"
import { QuestionPrompt } from "./question"
import { DialogExportOptions } from "../../ui/dialog-export-options"
import { formatTranscript } from "../../util/transcript"
import { UI } from "@/cli/ui.ts"
import { ensureDefaultParsers } from "@/cli/render/parsers"
import { segmentRichText, updateRichTextStream } from "@/cli/render/segment"
import { RichSegments } from "@/cli/render/tui"
import type { RichTextStream } from "@/cli/render/types"
import { useTuiConfig } from "../../context/tui-config"

ensureDefaultParsers()

const CUSTOM_TOOL_PARTS = new Set([
  "bash",
  "glob",
  "read",
  "grep",
  "list",
  "webfetch",
  "codesearch",
  "websearch",
  "write",
  "edit",
  "task",
  "apply_patch",
  "todowrite",
  "question",
  "skill",
])
const BASH_EXPAND_LINES = 10
const GENERIC_EXPAND_LINES = 3
const EDIT_EXPAND_LINES = 40
const PATCH_EXPAND_LINES = 60
const PATCH_FILE_PREVIEW_LINES = 20
const WRITE_EXPAND_LINES = 60
const REASONING_EXPAND_LINES = 18
const REASONING_EXPAND_CHARS = 1200
const OUTPUT_EXPAND_LINES = 20
const TODO_EXPAND_ITEMS = 8
const QUESTION_EXPAND_ITEMS = 4
const QUEUE_VISIBLE_ITEMS = 4

const OUTPUT_EXPAND_TOOL_PARTS = new Set([
  "read",
  "grep",
  "list",
  "glob",
  "webfetch",
  "codesearch",
  "websearch",
  "skill",
])

function lines(text: string) {
  if (!text.trim()) return 0
  return text.split("\n").length
}

function clip(text: string, max: number) {
  const all = text.split("\n")
  if (all.length <= max) return text
  return [...all.slice(0, max), "…"].join("\n")
}

function canExpandReasoning(text: string) {
  return lines(text) > REASONING_EXPAND_LINES || text.length > REASONING_EXPAND_CHARS
}

function patchlines(metadata: Record<string, unknown>) {
  const files = Array.isArray(metadata.files) ? metadata.files : []
  return files.reduce((sum, file) => {
    if (!file || typeof file !== "object" || !("diff" in file)) return sum
    const diff = typeof file.diff === "string" ? file.diff : ""
    return sum + lines(diff)
  }, 0)
}

function completedOutput(part: ToolPart) {
  if (part.state.status !== "completed") return ""
  return part.state.output.trim()
}

function canExpand(part: ToolPart, metadata: Record<string, unknown>, generic: boolean) {
  if (part.tool === "bash") {
    const output = typeof metadata.output === "string" ? stripAnsi(metadata.output.trim()) : ""
    return lines(output) > BASH_EXPAND_LINES
  }

  if (part.tool === "edit") {
    const diff = typeof metadata.diff === "string" ? metadata.diff : ""
    return lines(diff) > EDIT_EXPAND_LINES
  }

  if (part.tool === "apply_patch") {
    return patchlines(metadata) > PATCH_EXPAND_LINES
  }

  if (part.tool === "write") {
    if (part.state.status !== "completed") return false
    const content =
      typeof (part.state.input as any)?.content === "string" ? (part.state.input as any).content.trim() : ""
    return lines(content) > WRITE_EXPAND_LINES
  }

  if (part.tool === "todowrite") {
    if (part.state.status !== "completed") return false
    const todos = (part.state.input as any)?.todos
    if (!Array.isArray(todos)) return false
    return todos.length > TODO_EXPAND_ITEMS
  }

  if (part.tool === "question") {
    if (part.state.status !== "completed") return false
    const questions = (part.state.input as any)?.questions
    if (!Array.isArray(questions)) return false
    return questions.length > QUESTION_EXPAND_ITEMS
  }

  if (part.tool === "task") {
    if (part.state.status !== "completed") return false
    return lines(completedOutput(part)) > OUTPUT_EXPAND_LINES
  }

  if (OUTPUT_EXPAND_TOOL_PARTS.has(part.tool)) {
    return lines(completedOutput(part)) > OUTPUT_EXPAND_LINES
  }

  if (CUSTOM_TOOL_PARTS.has(part.tool)) return false
  if (!generic) return false
  if (part.state.status !== "completed") return false
  return lines(part.state.output.trim()) > GENERIC_EXPAND_LINES
}

class CustomSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {}

  tick(_now?: number): number {
    return this.speed
  }

  reset(): void {}
}

const context = createContext<{
  width: number
  sessionID: string
  conceal: () => boolean
  showThinking: () => boolean
  showTimestamps: () => boolean
  showDetails: () => boolean
  showGenericToolOutput: () => boolean
  isHistoryPartSelected: (id: string) => boolean
  isHistoryPromptSelected: (id: string) => boolean
  isHistoryTimeline: () => boolean
  diffWrapMode: () => "word" | "none"
  isToolExpanded: (id: string) => boolean
  toggleToolExpanded: (id: string) => void
  sync: ReturnType<typeof useSync>
  tui: ReturnType<typeof useTuiConfig>
}>()

function use() {
  const ctx = useContext(context)
  if (!ctx) throw new Error("useContext must be used within a Session component")
  return ctx
}

export function Session() {
  const route = useRouteData("session")
  const { navigate } = useRoute()
  const sync = useSync()
  const tabs = useSessionTabs()
  const tuiConfig = useTuiConfig()
  const kv = useKV()
  const { theme } = useTheme()
  const promptRef = usePromptRef()
  const session = createMemo(() => sync.session.get(route.sessionID))
  const children = createMemo(() => {
    const parentID = session()?.parentID ?? session()?.id
    return sync.data.session
      .filter((x) => x.parentID === parentID || x.id === parentID)
      .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  })
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
  const permissions = createMemo(() => {
    if (session()?.parentID) return []
    return children().flatMap((x) => sync.data.permission[x.id] ?? [])
  })
  const questions = createMemo(() => {
    if (session()?.parentID) return []
    return children().flatMap((x) => sync.data.question[x.id] ?? [])
  })

  const pending = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed)?.id
  })

  const lastAssistant = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant")
  })

  const dimensions = useTerminalDimensions()
  const [sidebar, setSidebar] = kv.signal<"auto" | "hide">("sidebar", "auto")
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>("summary")
  const [conceal, setConceal] = createSignal(true)
  const [showThinking, setShowThinking] = kv.signal("thinking_visibility", true)
  const [timestamps, setTimestamps] = kv.signal<"hide" | "show">("timestamps", "hide")
  const [showDetails, setShowDetails] = kv.signal("tool_details_visibility", true)
  const [showAssistantMetadata, setShowAssistantMetadata] = kv.signal("assistant_metadata_visibility", true)
  const [showScrollbar, setShowScrollbar] = kv.signal("scrollbar_visible", false)
  const [showHeader, setShowHeader] = kv.signal("header_visible", true)
  const [diffWrapMode] = kv.signal<"word" | "none">("diff_wrap_mode", "word")
  const [animationsEnabled, setAnimationsEnabled] = kv.signal("animations_enabled", true)
  const [showGenericToolOutput, setShowGenericToolOutput] = kv.signal("generic_tool_output_visibility", false)
  const [history, setHistory] = createSignal(false)
  const [historyPart, setHistoryPart] = createSignal<string>()
  const [historyPrompt, setHistoryPrompt] = createSignal<string>()
  const [target, setTarget] = createSignal<"prompt" | "timeline">("prompt")
  const [expandedToolParts, setExpandedToolParts] = createSignal<Record<string, boolean>>({})
  const [editor, setEditor] = createSignal<EditorInfo>()

  type HistoryTrace = {
    partID: string
    promptID: string
    anchorID: string
    kind: "text" | "tool" | "reasoning"
    childSessionID?: string
    expandable: boolean
    y: number
  }

  const wide = createMemo(() => dimensions().width > 120)
  const sidebarVisible = createMemo(() => {
    if (session()?.parentID) return false
    if (sidebarOpen()) return true
    if (sidebar() === "auto" && wide()) return true
    return false
  })
  const showFiles = () => {
    if (session()?.parentID) return
    batch(() => {
      setSidebarMode("files")
      setSidebarOpen(true)
    })
  }

  const showTimestamps = createMemo(() => timestamps() === "show")
  const contentWidth = createMemo(() => dimensions().width - (sidebarVisible() ? 42 : 0) - 4)

  const scrollAcceleration = createMemo(() => {
    const tui = tuiConfig
    if (tui?.scroll_acceleration?.enabled) {
      return new MacOSScrollAccel()
    }
    if (tui?.scroll_speed) {
      return new CustomSpeedScroll(tui.scroll_speed)
    }

    return new CustomSpeedScroll(3)
  })

  const follow = createMemo(() => !history() || target() === "prompt")
  const waiting = createMemo(() =>
    sessionWaiting({
      sessionID: route.sessionID,
      sessions: sync.data.session,
      permission: sync.data.permission,
      question: sync.data.question,
    }),
  )
  const busy = createMemo(() => {
    if (waiting()) return false
    const status = sync.data.session_status?.[route.sessionID]
    return status ? status.type !== "idle" : false
  })

  createEffect(async () => {
    await sync.session
      .sync(route.sessionID, true)
      .then(() => {
        if (scroll) scroll.scrollBy(100_000)
      })
      .catch((e) => {
        console.error(e)
        toast.show({
          message: `Session not found: ${route.sessionID}`,
          variant: "error",
        })
        return navigate({ type: "home", workspaceID: route.workspaceID })
      })
  })

  const toast = useToast()
  const sdk = useSDK()
  const editorUrl = (input: string) => {
    const next = new URL(input, sdk.url)
    if (sdk.directory) next.searchParams.set("directory", sdk.directory)
    if (route.workspaceID) next.searchParams.set("workspace", route.workspaceID)
    if (sdk.viewID) next.searchParams.set("viewID", sdk.viewID)
    next.searchParams.set("sessionID", route.sessionID)
    return next
  }
  const editorHeaders = () => new Headers(sdk.headers)
  const closeEditor = async () => {
    const info = editor()
    if (!info) return
    await (sdk.fetch ?? fetch)(editorUrl(`/editor/${info.id}`), {
      method: "DELETE",
      headers: editorHeaders(),
    }).catch(() => undefined)
    setEditor(undefined)
  }
  const requestCloseEditor = async () => {
    const info = editor()
    if (!info) return
    if (info.dirty) {
      const confirmed = await DialogConfirm.show(dialog, "Discard changes?", `Close ${info.file} without saving?`)
      if (!confirmed) return
    }
    await closeEditor()
  }
  const openEditor = async (file: string) => {
    const current = editor()
    if (current?.file === file) return
    if (current?.dirty) {
      const confirmed = await DialogConfirm.show(
        dialog,
        "Discard changes?",
        `Close ${current.file} without saving before opening ${file}?`,
      )
      if (!confirmed) return
    }
    if (current) await closeEditor()
    const response = await (sdk.fetch ?? fetch)(editorUrl("/editor"), {
      method: "POST",
      headers: (() => {
        const next = editorHeaders()
        next.set("content-type", "application/json")
        return next
      })(),
      body: JSON.stringify({
        sessionID: route.sessionID,
        file,
        size: {
          rows: Math.max(5, dimensions().height - 8),
          cols: Math.max(20, dimensions().width - 6),
        },
      }),
    })
    if (!response.ok) {
      toast.show({ message: await response.text(), variant: "error" })
      return
    }
    const info = (await response.json()) as EditorInfo
    setEditor(info)
  }
  const modified = createMemo(() => {
    const files = new Set((sync.data.session_diff[route.sessionID] ?? []).map((item) => item.file))
    if (editor()?.dirty && editor()?.file) files.add(editor()!.file)
    return files
  })

  // Handle initial prompt from fork
  createEffect(() => {
    if (route.initialPrompt && prompt) {
      prompt.set(route.initialPrompt)
    }
  })

  let lastSwitch: string | undefined = undefined
  sdk.event.on("message.part.updated", (evt) => {
    const part = evt.properties.part
    if (part.type !== "tool") return
    if (part.sessionID !== route.sessionID) return
    if (part.state.status !== "completed") return
    if (part.id === lastSwitch) return

    if (part.tool === "plan_exit") {
      local.agent.set("build")
      lastSwitch = part.id
    } else if (part.tool === "plan_enter") {
      local.agent.set("plan")
      lastSwitch = part.id
    }
  })

  let scroll: ScrollBoxRenderable
  let prompt: PromptRef
  const keybind = useKeybind()
  const openTab = (offset: 1 | -1) => {
    if (!tabs.switchable()) return false
    const next = adjacentTab(tabs.ids(), tabs.active(), offset)
    if (!next) return false
    tabs.open(next)
    return true
  }
  const dialog = useDialog()
  const renderer = useRenderer()

  // Allow exit when in child session (prompt is hidden)
  const exit = useExit()

  const isToolExpanded = (id: string) => expandedToolParts()[id] === true

  const toggleToolExpanded = (id: string) => {
    setExpandedToolParts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const isHistoryTimeline = () => history() && target() === "timeline"
  const isHistoryPartSelected = (id: string) => isHistoryTimeline() && historyPart() === id
  const isHistoryPromptSelected = (id: string) => isHistoryTimeline() && !historyPart() && historyPrompt() === id

  function setHistoryMode(value: boolean) {
    if (history() === value) return
    setHistory(value)
    setHistoryPart(undefined)
    setHistoryPrompt(undefined)
    setTarget(value ? "timeline" : "prompt")

    if (value) return

    const current = promptRef.current
    if (!current) return
    if (session()?.parentID) return
    if (permissions().length > 0 || questions().length > 0) return
    current.focus()
  }

  function toggleHistoryMode() {
    setHistoryMode(!history())
  }

  function focusPrompt() {
    if (session()?.parentID) return false
    if (permissions().length > 0 || questions().length > 0) return false
    const current = promptRef.current
    if (!current) return false
    setHistoryPart(undefined)
    setHistoryPrompt(undefined)
    setTarget("prompt")
    current.focus()
    return true
  }

  createEffect(
    on(
      () => route.sessionID,
      () => {
        setHistoryMode(false)
        setHistoryPart(undefined)
        setHistoryPrompt(undefined)
        setTarget("prompt")
        setExpandedToolParts({})
        void closeEditor()
        setEditor(undefined)
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    void closeEditor()
  })

  createEffect(() => {
    const title = Locale.truncate(session()?.title ?? "", 50)
    const pad = (text: string) => text.padEnd(10, " ")
    const weak = (text: string) => UI.Style.TEXT_DIM + pad(text) + UI.Style.TEXT_NORMAL
    const logo = UI.logo("  ").split(/\r?\n/)
    return exit.message.set(
      [
        ``,
        `${logo[0] ?? ""}`,
        `${logo[1] ?? ""}`,
        `${logo[2] ?? ""}`,
        `${logo[3] ?? ""}`,
        ``,
        `  ${weak("Session")}${UI.Style.TEXT_NORMAL_BOLD}${title}${UI.Style.TEXT_NORMAL}`,
        `  ${weak("Continue")}${UI.Style.TEXT_NORMAL_BOLD}slopcode -s ${session()?.id}${UI.Style.TEXT_NORMAL}`,
        ``,
      ].join("\n"),
    )
  })

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return
    if (editor()) return

    const handleAppExit = () => {
      if (!keybind.match("app_exit", evt)) return false
      if (renderer.getSelection()?.getSelectedText()) return false
      exit()
      evt.preventDefault()
      return true
    }

    if (keybind.match("history_mode_toggle", evt)) {
      const current = promptRef.current

      if (!history() && current?.focused && current.current.input.length > 0 && keybind.match("input_newline", evt)) {
        return
      }

      toggleHistoryMode()
      evt.preventDefault()
      return
    }

    if (keybind.match("session_tabs_previous", evt)) {
      if (!openTab(-1)) return
      keybind.keep()
      evt.preventDefault()
      return
    }

    if (keybind.match("session_tabs_next", evt)) {
      if (!openTab(1)) return
      keybind.keep()
      evt.preventDefault()
      return
    }

    if (history()) {
      if (handleAppExit()) return

      if (keybind.match("session_interrupt", evt)) {
        if (sync.data.session_status?.[route.sessionID]?.type === "idle") return
        command.trigger("session.interrupt")
        evt.preventDefault()
        return
      }

      if (target() !== "prompt" && keybind.match("input_submit", evt)) {
        setHistoryMode(false)
        evt.preventDefault()
        return
      }

      if (keybind.match("agent_cycle", evt)) {
        setHistoryMode(false)
        return
      }

      if (keybind.match("history_previous", evt)) {
        scrollToPrompt("prev")
        evt.preventDefault()
        return
      }

      if (keybind.match("history_next", evt)) {
        if (target() === "prompt" && evt.name === "down") return
        if (!scrollToPrompt("next")) focusPrompt()
        evt.preventDefault()
        return
      }

      if (evt.name === "left") {
        if (target() === "prompt") {
          const latestPrompt = promptIDs().at(-1)
          if (!focusLatestHistoryTrace(latestPrompt)) focusPromptByID(latestPrompt)
          evt.preventDefault()
          return
        }

        if (!moveHistoryTrace("prev")) focusPromptByID(currentPromptID())
        evt.preventDefault()
        return
      }

      if (evt.name === "right") {
        if (target() === "prompt") return

        if (!moveHistoryTrace("next") && !busy()) focusPrompt()
        evt.preventDefault()
        return
      }

      if (evt.name === "space") {
        if (target() === "prompt") return
        historyAction()
        evt.preventDefault()
        return
      }
    }

    if (!session()?.parentID) return
    handleAppExit()
  })

  const visiblePrompts = () => {
    const list = messages()
    return scroll
      .getChildren()
      .filter((child) => {
        if (!child.id) return false
        const message = list.find((item) => item.id === child.id)
        if (!message || message.role !== "user") return false

        const parts = sync.data.part[message.id]
        if (!parts || !Array.isArray(parts)) return false

        return parts.some((part) => part && part.type === "text" && !part.synthetic && !part.ignored)
      })
      .sort((a, b) => a.y - b.y)
  }

  const promptIDs = () => visiblePrompts().map((item) => item.id)

  const focusPromptByID = (id?: string) => {
    if (!id) return false
    const child = scroll.getChildren().find((item) => item.id === id)
    if (!child) return false
    setHistoryPart(undefined)
    setHistoryPrompt(id)
    setTarget("timeline")
    scroll.scrollBy(child.y - scroll.y - 1)
    return true
  }

  const currentPromptID = () => {
    const prompts = visiblePrompts()
    if (prompts.length === 0) return undefined

    if (target() === "prompt") {
      return prompts.at(-1)?.id
    }

    const selected = historyPart()
    if (selected) {
      const trace = historyTraceList().find((item) => item.partID === selected)
      if (trace) return trace.promptID
    }

    const chosen = historyPrompt()
    if (chosen && prompts.some((item) => item.id === chosen)) {
      return chosen
    }

    const top = scroll.y + 1
    return [...prompts].reverse().find((item) => item.y <= top)?.id ?? prompts[0]?.id
  }

  const scrollToPrompt = (direction: "next" | "prev") => {
    const prompts = promptIDs()
    if (prompts.length === 0) return false

    const selected = historyPart()
    if (selected) {
      const trace = historyTraceList().find((item) => item.partID === selected)
      if (trace) {
        const index = prompts.findIndex((item) => item === trace.promptID)
        if (index < 0) return false
        const next = direction === "next" ? prompts[index + 1] : prompts[index - 1]
        if (!next) return false
        return focusPromptByID(next)
      }
      setHistoryPart(undefined)
    }

    if (target() === "prompt" && direction === "prev") {
      return focusPromptByID(prompts.at(-1))
    }

    const current = currentPromptID()
    if (!current) return false

    const index = prompts.findIndex((item) => item === current)
    if (index < 0) return false

    const next = direction === "next" ? prompts[index + 1] : prompts[index - 1]
    if (!next) return false
    return focusPromptByID(next)
  }

  const historyTraces = (promptID: string): HistoryTrace[] => {
    const list = messages()
    const index = list.findIndex((item) => item.id === promptID && item.role === "user")
    if (index < 0) return []

    const turns = [] as AssistantMessage[]
    for (let i = index + 1; i < list.length; i++) {
      const item = list[i]
      if (!item) continue
      if (item.role === "user") break
      if (item.role === "assistant" && item.parentID === promptID) {
        turns.push(item as AssistantMessage)
      }
    }

    const anchors = new Map(
      scroll
        .getChildren()
        .filter((item) => !!item.id)
        .map((item) => [item.id!, item]),
    )

    const result: HistoryTrace[] = []

    for (const message of turns) {
      const parts = sync.data.part[message.id] ?? []
      for (const part of parts) {
        if (part.type === "text") {
          const text = part.text.trim()
          if (part.synthetic || part.ignored || !text) continue

          const anchorID = "text-" + part.id
          const anchor = anchors.get(anchorID)
          if (!anchor) continue

          result.push({
            partID: part.id,
            promptID,
            anchorID,
            kind: "text",
            expandable: false,
            y: anchor.y,
          })
          continue
        }

        if (part.type === "reasoning") {
          const text = part.text.replace("[REDACTED]", "").trim()
          if (!showThinking() || !text) continue

          const anchorID = "text-" + part.id
          const anchor = anchors.get(anchorID)
          if (!anchor) continue

          result.push({
            partID: part.id,
            promptID,
            anchorID,
            kind: "reasoning",
            expandable: canExpandReasoning(text),
            y: anchor.y,
          })
          continue
        }

        if (part.type !== "tool") continue
        if (!showDetails() && part.state.status === "completed") continue

        const anchorID = "tool-" + part.id
        const anchor = anchors.get(anchorID)
        if (!anchor) continue

        const metadata = (part.state.status === "pending" ? {} : (part.state.metadata ?? {})) as Record<string, unknown>
        const childSessionID =
          part.tool === "task" && typeof metadata.sessionId === "string" ? metadata.sessionId : undefined

        const expandable = canExpand(part, metadata, showGenericToolOutput())

        result.push({
          partID: part.id,
          promptID,
          anchorID,
          kind: "tool",
          childSessionID,
          expandable,
          y: anchor.y,
        })
      }
    }

    return result.sort((a, b) => a.y - b.y)
  }

  const historyTraceList = () => {
    const prompts = messages().flatMap((message) => {
      if (message.role !== "user") return []
      return [message.id]
    })
    return prompts.flatMap((id) => historyTraces(id)).sort((a, b) => a.y - b.y)
  }

  const focusHistoryTrace = (trace: HistoryTrace) => {
    const child = scroll.getChildren().find((item) => item.id === trace.anchorID)
    if (!child) return false
    setHistoryPrompt(trace.promptID)
    setHistoryPart(trace.partID)
    setTarget("timeline")
    scroll.scrollBy(child.y - scroll.y - 1)
    return true
  }

  const focusLatestHistoryTrace = (promptID?: string) => {
    if (!promptID) return false
    const latest = [...historyTraceList()].reverse().find((item) => item.promptID === promptID)
    if (!latest) return false
    return focusHistoryTrace(latest)
  }

  const moveHistoryTrace = (direction: "next" | "prev") => {
    const traces = historyTraceList()
    const promptID = currentPromptID()
    if (traces.length === 0) {
      return focusPromptByID(promptID)
    }

    const selectedID = historyPart()
    if (selectedID) {
      const trace = traces.find((item) => item.partID === selectedID)
      if (trace) {
        const group = traces.filter((item) => item.promptID === trace.promptID)
        const index = group.findIndex((item) => item.partID === selectedID)
        if (index < 0) return false

        if (direction === "next") {
          const next = group[index + 1]
          if (next) return focusHistoryTrace(next)

          const prompts = promptIDs()
          const promptIndex = prompts.findIndex((item) => item === trace.promptID)
          if (promptIndex < 0) return false

          const nextPrompt = prompts[promptIndex + 1]
          if (!nextPrompt) return false
          return focusPromptByID(nextPrompt)
        }

        const prev = group[index - 1]
        if (prev) return focusHistoryTrace(prev)
        return focusPromptByID(trace.promptID)
      }

      setHistoryPart(undefined)
    }

    if (!promptID) {
      const edge = direction === "next" ? traces[0] : traces.at(-1)
      if (!edge) return false
      return focusHistoryTrace(edge)
    }

    if (direction === "next") {
      const first = traces.find((item) => item.promptID === promptID)
      if (first) return focusHistoryTrace(first)
      return focusPromptByID(promptID)
    }

    const prompts = promptIDs()
    const index = prompts.findIndex((item) => item === promptID)
    if (index < 0) return false
    const prevPrompt = prompts[index - 1]
    if (!prevPrompt) return focusPromptByID(promptID)
    const last = [...traces].reverse().find((item) => item.promptID === prevPrompt)
    if (last) return focusHistoryTrace(last)
    return focusPromptByID(prevPrompt)
  }

  const historyAction = () => {
    const traces = historyTraceList()
    if (traces.length === 0) return

    const current = (() => {
      const selectedID = historyPart()
      if (selectedID) {
        const selected = traces.find((item) => item.partID === selectedID)
        if (selected) return selected
      }

      const top = scroll.y + 1
      return traces.find((item) => item.y >= top) ?? traces.at(-1)
    })()

    if (!current) return
    setHistoryPrompt(current.promptID)
    setHistoryPart(current.partID)
    setTarget("timeline")

    if (current.expandable) {
      toggleToolExpanded(current.partID)
      return
    }

    if (!current.childSessionID) return
    navigate({
      type: "session",
      sessionID: current.childSessionID,
      source: "child",
      workspaceID: route.workspaceID,
    })
  }

  createEffect(() => {
    if (!history()) return
    if (!scroll || scroll.isDestroyed) return

    const traces = historyTraceList()
    const prompts = promptIDs()
    const selectedPart = historyPart()
    if (selectedPart && !traces.some((item) => item.partID === selectedPart)) {
      setHistoryPart(undefined)
    }

    const selectedPrompt = historyPrompt()
    if (selectedPrompt && !prompts.includes(selectedPrompt)) {
      setHistoryPrompt(prompts.at(-1))
    }
  })

  // Helper: Find next visible message boundary in direction
  const findNextVisibleMessage = (direction: "next" | "prev"): string | null => {
    const children = scroll.getChildren()
    const messagesList = messages()
    const scrollTop = scroll.y

    // Get visible messages sorted by position, filtering for valid non-synthetic, non-ignored content
    const visibleMessages = children
      .filter((c) => {
        if (!c.id) return false
        const message = messagesList.find((m) => m.id === c.id)
        if (!message) return false

        // Check if message has valid non-synthetic, non-ignored text parts
        const parts = sync.data.part[message.id]
        if (!parts || !Array.isArray(parts)) return false

        return parts.some((part) => part && part.type === "text" && !part.synthetic && !part.ignored)
      })
      .sort((a, b) => a.y - b.y)

    if (visibleMessages.length === 0) return null

    if (direction === "next") {
      // Find first message below current position
      return visibleMessages.find((c) => c.y > scrollTop + 10)?.id ?? null
    }
    // Find last message above current position
    return [...visibleMessages].reverse().find((c) => c.y < scrollTop - 10)?.id ?? null
  }

  // Helper: Scroll to message in direction or fallback to page scroll
  const scrollToMessage = (direction: "next" | "prev", dialog: ReturnType<typeof useDialog>) => {
    const targetID = findNextVisibleMessage(direction)

    if (!targetID) {
      scroll.scrollBy(direction === "next" ? scroll.height : -scroll.height)
      dialog.clear()
      return
    }

    const child = scroll.getChildren().find((c) => c.id === targetID)
    if (child) scroll.scrollBy(child.y - scroll.y - 1)
    dialog.clear()
  }

  function toBottom() {
    setTimeout(() => {
      if (!scroll || scroll.isDestroyed) return
      scroll.scrollTo(scroll.scrollHeight)
    }, 50)
  }

  const local = useLocal()

  function moveFirstChild() {
    if (children().length === 1) return
    const next = children().find((x) => !!x.parentID)
    if (next) {
      navigate({
        type: "session",
        sessionID: next.id,
        source: "child",
        workspaceID: route.workspaceID,
      })
    }
  }

  function moveChild(direction: number) {
    if (children().length === 1) return

    const sessions = children().filter((x) => !!x.parentID)
    let next = sessions.findIndex((x) => x.id === session()?.id) + direction

    if (next >= sessions.length) next = 0
    if (next < 0) next = sessions.length - 1
    if (sessions[next]) {
      navigate({
        type: "session",
        sessionID: sessions[next].id,
        source: "child",
        workspaceID: route.workspaceID,
      })
    }
  }

  function childSessionHandler(func: (dialog: DialogContext) => void) {
    return (dialog: DialogContext) => {
      if (!session()?.parentID || dialog.stack.length > 0) return
      func(dialog)
    }
  }

  const command = useCommandDialog()
  command.register(() => [
    {
      title: session()?.share?.url ? "Copy share link" : "Share session",
      value: "session.share",
      suggested: route.type === "session",
      keybind: "session_share",
      category: "Session",
      enabled: sync.data.config.share !== "disabled",
      slash: {
        name: "share",
      },
      onSelect: async (dialog) => {
        const copy = (url: string) =>
          Clipboard.copy(url)
            .then(() => toast.show({ message: "Share URL copied to clipboard!", variant: "success" }))
            .catch(() => toast.show({ message: "Failed to copy URL to clipboard", variant: "error" }))
        const url = session()?.share?.url
        if (url) {
          await copy(url)
          dialog.clear()
          return
        }
        await sdk.client.session
          .share({
            sessionID: route.sessionID,
          })
          .then((res) => copy(res.data!.share!.url))
          .catch(() => toast.show({ message: "Failed to share session", variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: "Rename session",
      value: "session.rename",
      keybind: "session_rename",
      category: "Session",
      slash: {
        name: "rename",
      },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogSessionRename session={route.sessionID} />)
      },
    },
    {
      title: "Jump to message",
      value: "session.timeline",
      keybind: "session_timeline",
      category: "Session",
      slash: {
        name: "timeline",
      },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogTimeline
            onMove={(messageID) => {
              const child = scroll.getChildren().find((child) => {
                return child.id === messageID
              })
              if (child) scroll.scrollBy(child.y - scroll.y - 1)
            }}
            sessionID={route.sessionID}
            setPrompt={(promptInfo) => prompt.set(promptInfo)}
          />
        ))
      },
    },
    {
      title: "Fork from message",
      value: "session.fork",
      keybind: "session_fork",
      category: "Session",
      slash: {
        name: "fork",
      },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogForkFromTimeline
            onMove={(messageID) => {
              const child = scroll.getChildren().find((child) => {
                return child.id === messageID
              })
              if (child) scroll.scrollBy(child.y - scroll.y - 1)
            }}
            sessionID={route.sessionID}
          />
        ))
      },
    },
    {
      title: history() ? "Exit history mode" : "Enter history mode",
      value: "session.history.toggle",
      category: "Session",
      slash: {
        name: "history",
      },
      onSelect: (dialog) => {
        toggleHistoryMode()
        dialog.clear()
      },
    },
    {
      title: "History previous prompt",
      value: "session.history.previous",
      category: "Session",
      hidden: true,
      enabled: history(),
      onSelect: () => {
        scrollToPrompt("prev")
      },
    },
    {
      title: "History next prompt",
      value: "session.history.next",
      category: "Session",
      hidden: true,
      enabled: history(),
      onSelect: () => {
        if (!scrollToPrompt("next")) focusPrompt()
      },
    },
    {
      title: "History previous trace",
      value: "session.history.left",
      category: "Session",
      hidden: true,
      enabled: history(),
      onSelect: () => {
        if (target() === "prompt") {
          const latestPrompt = promptIDs().at(-1)
          if (!focusLatestHistoryTrace(latestPrompt)) focusPromptByID(latestPrompt)
          return
        }
        if (!moveHistoryTrace("prev")) focusPromptByID(currentPromptID())
      },
    },
    {
      title: "History next trace",
      value: "session.history.right",
      category: "Session",
      hidden: true,
      enabled: history(),
      onSelect: () => {
        if (target() === "prompt") return
        if (!moveHistoryTrace("next") && !busy()) focusPrompt()
      },
    },
    {
      title: "Compact session",
      value: "session.compact",
      keybind: "session_compact",
      category: "Session",
      slash: {
        name: "compact",
        aliases: ["summarize"],
      },
      onSelect: (dialog) => {
        const selectedModel = local.model.current()
        if (!selectedModel) {
          toast.show({
            variant: "warning",
            message: "Connect a provider to summarize this session",
            duration: 3000,
          })
          return
        }
        sdk.client.session.summarize({
          sessionID: route.sessionID,
          modelID: selectedModel.modelID,
          providerID: selectedModel.providerID,
        })
        dialog.clear()
      },
    },
    {
      title: "Unshare session",
      value: "session.unshare",
      keybind: "session_unshare",
      category: "Session",
      enabled: !!session()?.share?.url,
      slash: {
        name: "unshare",
      },
      onSelect: async (dialog) => {
        await sdk.client.session
          .unshare({
            sessionID: route.sessionID,
          })
          .then(() => toast.show({ message: "Session unshared successfully", variant: "success" }))
          .catch(() => toast.show({ message: "Failed to unshare session", variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: "Undo previous message",
      value: "session.undo",
      keybind: "messages_undo",
      category: "Session",
      slash: {
        name: "undo",
      },
      onSelect: async (dialog) => {
        const status = sync.data.session_status?.[route.sessionID]
        if (status?.type !== "idle") await sdk.client.session.abort({ sessionID: route.sessionID }).catch(() => {})
        const revert = session()?.revert?.messageID
        const message = messages().findLast((x) => (!revert || x.id < revert) && x.role === "user")
        if (!message) return
        sdk.client.session
          .revert({
            sessionID: route.sessionID,
            messageID: message.id,
          })
          .then(() => {
            toBottom()
          })
        const parts = sync.data.part[message.id]
        prompt.set(
          parts.reduce(
            (agg, part) => {
              if (part.type === "text") {
                if (!part.synthetic) agg.input += part.text
              }
              if (part.type === "file") agg.parts.push(part)
              return agg
            },
            { input: "", parts: [] as PromptInfo["parts"] },
          ),
        )
        dialog.clear()
      },
    },
    {
      title: "Redo",
      value: "session.redo",
      keybind: "messages_redo",
      category: "Session",
      enabled: !!session()?.revert?.messageID,
      slash: {
        name: "redo",
      },
      onSelect: (dialog) => {
        dialog.clear()
        const messageID = session()?.revert?.messageID
        if (!messageID) return
        const message = messages().find((x) => x.role === "user" && x.id > messageID)
        if (!message) {
          sdk.client.session.unrevert({
            sessionID: route.sessionID,
          })
          prompt.set({ input: "", parts: [] })
          return
        }
        sdk.client.session.revert({
          sessionID: route.sessionID,
          messageID: message.id,
        })
      },
    },
    {
      title: sidebarVisible() ? "Hide sidebar" : "Show sidebar",
      value: "session.sidebar.toggle",
      keybind: "sidebar_toggle",
      category: "Session",
      onSelect: (dialog) => {
        batch(() => {
          const isVisible = sidebarVisible()
          if (isVisible) {
            setSidebar(() => "hide")
            setSidebarOpen(false)
            dialog.clear()
            return
          }
          setSidebarMode("summary")
          setSidebar(() => "auto")
          setSidebarOpen(true)
        })
        dialog.clear()
      },
    },
    {
      title: "Open file explorer",
      value: "session.files.open",
      keybind: "session_files",
      category: "Session",
      enabled: !session()?.parentID,
      slash: {
        name: "files",
        aliases: ["explorer"],
      },
      onSelect: (dialog) => {
        showFiles()
        dialog.clear()
      },
    },
    {
      title: conceal() ? "Disable code concealment" : "Enable code concealment",
      value: "session.toggle.conceal",
      keybind: "messages_toggle_conceal" as any,
      category: "Session",
      onSelect: (dialog) => {
        setConceal((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showTimestamps() ? "Hide timestamps" : "Show timestamps",
      value: "session.toggle.timestamps",
      category: "Session",
      slash: {
        name: "timestamps",
        aliases: ["toggle-timestamps"],
      },
      onSelect: (dialog) => {
        setTimestamps((prev) => (prev === "show" ? "hide" : "show"))
        dialog.clear()
      },
    },
    {
      title: showThinking() ? "Hide thinking" : "Show thinking",
      value: "session.toggle.thinking",
      keybind: "display_thinking",
      category: "Session",
      slash: {
        name: "thinking",
        aliases: ["toggle-thinking"],
      },
      onSelect: (dialog) => {
        setShowThinking((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showDetails() ? "Hide tool details" : "Show tool details",
      value: "session.toggle.actions",
      keybind: "tool_details",
      category: "Session",
      onSelect: (dialog) => {
        setShowDetails((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: "Toggle session scrollbar",
      value: "session.toggle.scrollbar",
      keybind: "scrollbar_toggle",
      category: "Session",
      onSelect: (dialog) => {
        setShowScrollbar((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showHeader() ? "Hide header" : "Show header",
      value: "session.toggle.header",
      category: "Session",
      onSelect: (dialog) => {
        setShowHeader((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showGenericToolOutput() ? "Hide generic tool output" : "Show generic tool output",
      value: "session.toggle.generic_tool_output",
      category: "Session",
      onSelect: (dialog) => {
        setShowGenericToolOutput((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: "Page up",
      value: "session.page.up",
      keybind: "messages_page_up",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(-scroll.height / 2)
        dialog.clear()
      },
    },
    {
      title: "Page down",
      value: "session.page.down",
      keybind: "messages_page_down",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(scroll.height / 2)
        dialog.clear()
      },
    },
    {
      title: "Line up",
      value: "session.line.up",
      keybind: "messages_line_up",
      category: "Session",
      disabled: true,
      onSelect: (dialog) => {
        scroll.scrollBy(-1)
        dialog.clear()
      },
    },
    {
      title: "Line down",
      value: "session.line.down",
      keybind: "messages_line_down",
      category: "Session",
      disabled: true,
      onSelect: (dialog) => {
        scroll.scrollBy(1)
        dialog.clear()
      },
    },
    {
      title: "Half page up",
      value: "session.half.page.up",
      keybind: "messages_half_page_up",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(-scroll.height / 4)
        dialog.clear()
      },
    },
    {
      title: "Half page down",
      value: "session.half.page.down",
      keybind: "messages_half_page_down",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(scroll.height / 4)
        dialog.clear()
      },
    },
    {
      title: "First message",
      value: "session.first",
      keybind: "messages_first",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollTo(0)
        dialog.clear()
      },
    },
    {
      title: "Last message",
      value: "session.last",
      keybind: "messages_last",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollTo(scroll.scrollHeight)
        dialog.clear()
      },
    },
    {
      title: "Jump to last user message",
      value: "session.messages_last_user",
      keybind: "messages_last_user",
      category: "Session",
      hidden: true,
      onSelect: () => {
        const messages = sync.data.message[route.sessionID]
        if (!messages || !messages.length) return

        // Find the most recent user message with non-ignored, non-synthetic text parts
        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i]
          if (!message || message.role !== "user") continue

          const parts = sync.data.part[message.id]
          if (!parts || !Array.isArray(parts)) continue

          const hasValidTextPart = parts.some(
            (part) => part && part.type === "text" && !part.synthetic && !part.ignored,
          )

          if (hasValidTextPart) {
            const child = scroll.getChildren().find((child) => {
              return child.id === message.id
            })
            if (child) scroll.scrollBy(child.y - scroll.y - 1)
            break
          }
        }
      },
    },
    {
      title: "Next message",
      value: "session.message.next",
      keybind: "messages_next",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => scrollToMessage("next", dialog),
    },
    {
      title: "Previous message",
      value: "session.message.previous",
      keybind: "messages_previous",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => scrollToMessage("prev", dialog),
    },
    {
      title: "Copy last assistant message",
      value: "messages.copy",
      keybind: "messages_copy",
      category: "Session",
      onSelect: (dialog) => {
        const revertID = session()?.revert?.messageID
        const lastAssistantMessage = messages().findLast(
          (msg) => msg.role === "assistant" && (!revertID || msg.id < revertID),
        )
        if (!lastAssistantMessage) {
          toast.show({ message: "No assistant messages found", variant: "error" })
          dialog.clear()
          return
        }

        const parts = sync.data.part[lastAssistantMessage.id] ?? []
        const textParts = parts.filter((part) => part.type === "text")
        if (textParts.length === 0) {
          toast.show({ message: "No text parts found in last assistant message", variant: "error" })
          dialog.clear()
          return
        }

        const text = textParts
          .map((part) => part.text)
          .join("\n")
          .trim()
        if (!text) {
          toast.show({
            message: "No text content found in last assistant message",
            variant: "error",
          })
          dialog.clear()
          return
        }

        Clipboard.copy(text)
          .then(() => toast.show({ message: "Message copied to clipboard!", variant: "success" }))
          .catch(() => toast.show({ message: "Failed to copy to clipboard", variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: "Copy session transcript",
      value: "session.copy",
      category: "Session",
      slash: {
        name: "copy",
      },
      onSelect: async (dialog) => {
        try {
          const sessionData = session()
          if (!sessionData) return
          const sessionMessages = messages()
          const transcript = formatTranscript(
            sessionData,
            sessionMessages.map((msg) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
            {
              thinking: showThinking(),
              toolDetails: showDetails(),
              assistantMetadata: showAssistantMetadata(),
            },
          )
          await Clipboard.copy(transcript)
          toast.show({ message: "Session transcript copied to clipboard!", variant: "success" })
        } catch (error) {
          toast.show({ message: "Failed to copy session transcript", variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: "Export session transcript",
      value: "session.export",
      keybind: "session_export",
      category: "Session",
      slash: {
        name: "export",
      },
      onSelect: async (dialog) => {
        try {
          const sessionData = session()
          if (!sessionData) return
          const sessionMessages = messages()

          const defaultFilename = `session-${sessionData.id.slice(0, 8)}.md`

          const options = await DialogExportOptions.show(
            dialog,
            defaultFilename,
            showThinking(),
            showDetails(),
            showAssistantMetadata(),
            false,
          )

          if (options === null) return

          const transcript = formatTranscript(
            sessionData,
            sessionMessages.map((msg) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
            {
              thinking: options.thinking,
              toolDetails: options.toolDetails,
              assistantMetadata: options.assistantMetadata,
            },
          )

          if (options.openWithoutSaving) {
            // Just open in editor without saving
            await Editor.open({ value: transcript, renderer })
          } else {
            const exportDir = process.cwd()
            const filename = options.filename.trim()
            const filepath = path.join(exportDir, filename)

            await Bun.write(filepath, transcript)

            // Open with EDITOR if available
            const result = await Editor.open({ value: transcript, renderer })
            if (result !== undefined) {
              await Bun.write(filepath, result)
            }

            toast.show({ message: `Session exported to ${filename}`, variant: "success" })
          }
        } catch (error) {
          toast.show({ message: "Failed to export session", variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: "Previous session tab",
      value: "session.tabs.previous",
      keybind: "session_tabs_previous",
      category: "Session",
      enabled: tabs.switchable(),
      hidden: true,
      onSelect: (dialog) => {
        openTab(-1)
        dialog.clear()
      },
    },
    {
      title: "Next session tab",
      value: "session.tabs.next",
      keybind: "session_tabs_next",
      category: "Session",
      enabled: tabs.switchable(),
      hidden: true,
      onSelect: (dialog) => {
        openTab(1)
        dialog.clear()
      },
    },
    {
      title: "Go to child session",
      value: "session.child.first",
      keybind: "session_child_first",
      category: "Session",
      enabled: children().some((x) => !!x.parentID),
      hidden: true,
      onSelect: (dialog) => {
        moveFirstChild()
        dialog.clear()
      },
    },
    {
      title: "Go to parent session",
      value: "session.parent",
      keybind: "session_parent",
      category: "Session",
      enabled: !!session()?.parentID,
      hidden: true,
      onSelect: childSessionHandler((dialog) => {
        const parentID = session()?.parentID
        if (parentID) {
          navigate({
            type: "session",
            sessionID: parentID,
            source: "switch",
            workspaceID: route.workspaceID,
          })
        }
        dialog.clear()
      }),
    },
    {
      title: "Next child session",
      value: "session.child.next",
      keybind: "session_child_cycle",
      category: "Session",
      enabled: !!session()?.parentID,
      hidden: true,
      onSelect: childSessionHandler((dialog) => {
        moveChild(1)
        dialog.clear()
      }),
    },
    {
      title: "Previous child session",
      value: "session.child.previous",
      keybind: "session_child_cycle_reverse",
      category: "Session",
      enabled: !!session()?.parentID,
      hidden: true,
      onSelect: childSessionHandler((dialog) => {
        moveChild(-1)
        dialog.clear()
      }),
    },
  ])

  const revertInfo = createMemo(() => session()?.revert)
  const revertMessageID = createMemo(() => revertInfo()?.messageID)

  const revertDiffFiles = createMemo(() => {
    const diffText = revertInfo()?.diff ?? ""
    if (!diffText) return []

    try {
      const patches = parsePatch(diffText)
      return patches.map((patch) => {
        const filename = patch.newFileName || patch.oldFileName || "unknown"
        const cleanFilename = filename.replace(/^[ab]\//, "")
        return {
          filename: cleanFilename,
          additions: patch.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.startsWith("+")).length,
            0,
          ),
          deletions: patch.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.startsWith("-")).length,
            0,
          ),
        }
      })
    } catch (error) {
      return []
    }
  })

  const revertRevertedMessages = createMemo(() => {
    const messageID = revertMessageID()
    if (!messageID) return []
    return messages().filter((x) => x.id >= messageID && x.role === "user")
  })

  const revert = createMemo(() => {
    const info = revertInfo()
    if (!info) return
    if (!info.messageID) return
    return {
      messageID: info.messageID,
      reverted: revertRevertedMessages(),
      diff: info.diff,
      diffFiles: revertDiffFiles(),
    }
  })

  // snap to bottom when session changes
  createEffect(on(() => route.sessionID, toBottom))

  return (
    <context.Provider
      value={{
        get width() {
          return contentWidth()
        },
        sessionID: route.sessionID,
        conceal,
        showThinking,
        showTimestamps,
        showDetails,
        showGenericToolOutput,
        isHistoryPartSelected,
        isHistoryPromptSelected,
        isHistoryTimeline,
        diffWrapMode,
        isToolExpanded,
        toggleToolExpanded,
        sync,
        tui: tuiConfig,
      }}
    >
      <box flexDirection="row">
        <Show
          when={!editor()}
          fallback={
            <EditorPane
              sessionID={route.sessionID}
              info={editor}
              onChange={(next) => setEditor((prev) => (prev ? { ...prev, ...next } : (next as EditorInfo)))}
              onRequestClose={() => {
                void requestCloseEditor()
              }}
              onClosed={() => {
                setEditor(undefined)
              }}
            />
          }
        >
          <box flexGrow={1}>
            <SessionStrip
              action={
                session()?.parentID
                  ? undefined
                  : {
                      active: sidebarVisible() && sidebarMode() === "files",
                      onSelect: showFiles,
                    }
              }
            />
            <box flexGrow={1} paddingTop={1} paddingLeft={2} paddingRight={2} gap={1}>
              <Show when={session()}>
                <Show when={showHeader() && (!sidebarVisible() || !wide())}>
                  <Header />
                </Show>
                <scrollbox
                  ref={(r) => (scroll = r)}
                  viewportOptions={{
                    paddingRight: showScrollbar() ? 1 : 0,
                  }}
                  verticalScrollbarOptions={{
                    paddingLeft: 1,
                    visible: showScrollbar(),
                    trackOptions: {
                      backgroundColor: theme.backgroundElement,
                      foregroundColor: theme.border,
                    },
                  }}
                  stickyScroll={follow()}
                  stickyStart="bottom"
                  flexGrow={1}
                  scrollAcceleration={scrollAcceleration()}
                >
                  <For each={messages()}>
                    {(message, index) => (
                      <Switch>
                        <Match when={message.id === revert()?.messageID}>
                          {(function () {
                            const command = useCommandDialog()
                            const [hover, setHover] = createSignal(false)
                            const dialog = useDialog()

                            const handleUnrevert = async () => {
                              const confirmed = await DialogConfirm.show(
                                dialog,
                                "Confirm Redo",
                                "Are you sure you want to restore the reverted messages?",
                              )
                              if (confirmed) {
                                command.trigger("session.redo")
                              }
                            }

                            return (
                              <box
                                onMouseOver={() => setHover(true)}
                                onMouseOut={() => setHover(false)}
                                onMouseUp={handleUnrevert}
                                marginTop={1}
                                flexShrink={0}
                                border={["left"]}
                                customBorderChars={SplitBorder.customBorderChars}
                                borderColor={theme.backgroundPanel}
                              >
                                <box
                                  paddingTop={1}
                                  paddingBottom={1}
                                  paddingLeft={2}
                                  backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
                                >
                                  <text fg={theme.textMuted}>{revert()!.reverted.length} message reverted</text>
                                  <text fg={theme.textMuted}>
                                    <span style={{ fg: theme.text }}>{keybind.print("messages_redo")}</span> or /redo to
                                    restore
                                  </text>
                                  <Show when={revert()!.diffFiles?.length}>
                                    <box marginTop={1}>
                                      <For each={revert()!.diffFiles}>
                                        {(file) => (
                                          <text fg={theme.text}>
                                            {file.filename}
                                            <Show when={file.additions > 0}>
                                              <span style={{ fg: theme.diffAdded }}> +{file.additions}</span>
                                            </Show>
                                            <Show when={file.deletions > 0}>
                                              <span style={{ fg: theme.diffRemoved }}> -{file.deletions}</span>
                                            </Show>
                                          </text>
                                        )}
                                      </For>
                                    </box>
                                  </Show>
                                </box>
                              </box>
                            )
                          })()}
                        </Match>
                        <Match when={revert()?.messageID && message.id >= revert()!.messageID}>
                          <></>
                        </Match>
                        <Match when={message.role === "user"}>
                          <UserMessage
                            index={index()}
                            onMouseUp={() => {
                              if (renderer.getSelection()?.getSelectedText()) return
                              dialog.replace(() => (
                                <DialogMessage
                                  messageID={message.id}
                                  sessionID={route.sessionID}
                                  setPrompt={(promptInfo) => prompt.set(promptInfo)}
                                />
                              ))
                            }}
                            message={message as UserMessage}
                            parts={sync.data.part[message.id] ?? []}
                            pending={pending()}
                          />
                        </Match>
                        <Match when={message.role === "assistant"}>
                          <AssistantMessage
                            last={lastAssistant()?.id === message.id}
                            message={message as AssistantMessage}
                            parts={sync.data.part[message.id] ?? []}
                          />
                        </Match>
                      </Switch>
                    )}
                  </For>
                </scrollbox>
                <box flexShrink={0}>
                  <Show when={permissions().length > 0}>
                    <PermissionPrompt request={permissions()[0]} />
                  </Show>
                  <Show when={permissions().length === 0 && questions().length > 0}>
                    <QuestionPrompt request={questions()[0]} />
                  </Show>
                  <PromptQueuePanel sessionID={route.sessionID} />
                  <Prompt
                    visible={!session()?.parentID && permissions().length === 0 && questions().length === 0}
                    historyMode={history()}
                    historyTarget={target()}
                    onFocus={() => {
                      setHistoryPart(undefined)
                      setHistoryPrompt(undefined)
                      setTarget("prompt")
                    }}
                    ref={(r) => {
                      prompt = r
                      promptRef.set(r)
                      // Apply initial prompt when prompt component mounts (e.g., from fork)
                      if (route.initialPrompt) {
                        r.set(route.initialPrompt)
                      }
                    }}
                    disabled={permissions().length > 0 || questions().length > 0}
                    onSubmit={() => {
                      toBottom()
                    }}
                    sessionID={route.sessionID}
                  />
                </box>
              </Show>
              <Toast />
            </box>
          </box>
          <Show when={sidebarVisible()}>
            <Switch>
              <Match when={wide()}>
                <Sidebar
                  sessionID={route.sessionID}
                  mode={sidebarMode()}
                  modified={modified()}
                  activeFile={editor()?.file}
                  openFile={(file) => {
                    void openEditor(file)
                  }}
                  setMode={(mode) => setSidebarMode(mode)}
                />
              </Match>
              <Match when={!wide()}>
                <box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  alignItems="flex-end"
                  backgroundColor={RGBA.fromInts(0, 0, 0, 70)}
                >
                  <Sidebar
                    sessionID={route.sessionID}
                    mode={sidebarMode()}
                    modified={modified()}
                    activeFile={editor()?.file}
                    openFile={(file) => {
                      void openEditor(file)
                    }}
                    setMode={(mode) => setSidebarMode(mode)}
                  />
                </box>
              </Match>
            </Switch>
          </Show>
        </Show>
      </box>
    </context.Provider>
  )
}

type QueueRow = {
  id: string
  label: string
  mode: "normal" | "shell"
  agent: string
  summary: string
  detail?: string
  time: PromptQueueItem["time"]
}

const initial = (value: string) => value.trim().charAt(0).toUpperCase() || "?"

function PromptQueuePanel(props: { sessionID: string }) {
  const local = useLocal()
  const syncState = useSync()
  const { theme } = useTheme()
  const renderer = useRenderer()
  const [store, setStore] = createStore({
    active: undefined as PromptQueueItem | undefined,
    paused: undefined as PromptQueueItem | undefined,
    queue: [] as PromptQueueItem[],
    collapsed: false,
  })
  const [now, setNow] = createSignal(Date.now())

  createEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => {
      clearInterval(timer)
    })
  })

  const refresh = () => {
    const next = promptQueue.snapshot(props.sessionID)
    setStore("active", next.active)
    setStore("paused", next.paused)
    setStore("queue", next.queue)
  }

  createEffect(on(() => props.sessionID, refresh))

  const off = promptQueue.subscribe((key: string) => {
    if (key !== props.sessionID) return
    refresh()
  })

  onCleanup(off)

  const status = createMemo(() => syncState.data.session_status?.[props.sessionID])

  const rows = createMemo<QueueRow[]>(() => {
    const active = store.active
      ? [
          {
            id: store.active.id,
            label: "Active",
            mode: store.active.mode,
            agent: store.active.agent,
            summary: store.active.summary,
            detail: store.active.detail,
            time: store.active.time,
          },
        ]
      : []

    const paused = store.paused
      ? [
          {
            id: store.paused.id,
            label: "Paused",
            mode: store.paused.mode,
            agent: store.paused.agent,
            summary: store.paused.summary,
            detail: store.paused.detail,
            time: store.paused.time,
          },
        ]
      : []

    return [
      ...active,
      ...paused,
      ...store.queue.map((item: PromptQueueItem) => ({
        id: item.id,
        label: "Queued",
        mode: item.mode,
        agent: item.agent,
        summary: item.summary,
        detail: item.detail,
        time: item.time,
      })),
    ]
  })

  const visible = createMemo(() => rows().slice(0, QUEUE_VISIBLE_ITEMS))
  const hidden = createMemo(() => Math.max(0, rows().length - QUEUE_VISIBLE_ITEMS))
  const preview = createMemo(() => {
    const text = store.active?.summary ?? store.paused?.summary ?? store.queue[0]?.summary ?? ""
    if (text.length <= 48) return text
    return text.slice(0, 45).trimEnd() + "..."
  })

  const color = (item: QueueRow) => {
    if (item.label === "Paused") return theme.textMuted
    return item.mode === "shell" ? theme.primary : local.agent.color(item.agent)
  }
  const meta = (item: QueueRow) => {
    const base = item.label === "Active" ? status() : undefined
    const start = base?.type === "busy" ? base.since : (item.time.started ?? item.time.queued)
    const elapsed = formatDuration(Math.max(0, Math.round((now() - start) / 1000))) || "0s"
    if (item.label === "Queued") return [`queued ${elapsed}`, item.detail].filter(Boolean).join(" - ")
    if (item.label === "Paused") return [`paused ${elapsed}`, item.detail].filter(Boolean).join(" - ")
    if (base?.type === "retry") {
      const delay = formatDuration(Math.max(0, Math.round((base.next - now()) / 1000))) || "0s"
      return [`retrying in ${delay}`, item.detail].filter(Boolean).join(" - ")
    }
    if (base?.type === "busy" && base.phase === "compacting") {
      return [`compacting ${elapsed}`, item.detail].filter(Boolean).join(" - ")
    }
    if (base?.type === "busy" && base.phase === "running") {
      return [`${now() - start >= 15_000 ? "still running..." : "running"} ${elapsed}`, item.detail]
        .filter(Boolean)
        .join(" - ")
    }
    return [`${now() - start >= 15_000 ? "still starting..." : "starting"} ${elapsed}`, item.detail]
      .filter(Boolean)
      .join(" - ")
  }

  const toggle = () => {
    setStore("collapsed", (value) => !value)
  }

  const clear = () => {
    promptQueue.clear(props.sessionID)
  }

  const remove = (id: string) => {
    promptQueue.remove(props.sessionID, (item) => item.id === id)
  }

  return (
    <Show when={!!store.active || !!store.paused || store.queue.length > 0}>
      <box
        backgroundColor={theme.backgroundPanel}
        marginBottom={1}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        gap={1}
      >
        <box paddingLeft={3} paddingRight={3} flexDirection="row" justifyContent="space-between">
          <box
            flexDirection="row"
            gap={2}
            onMouseUp={() => {
              if (renderer.getSelection()?.getSelectedText()) return
              toggle()
            }}
          >
            <text fg={theme.textMuted}># Queue</text>
            <Show when={store.collapsed && preview()}>
              <text fg={theme.text}>{preview()}</text>
            </Show>
            <text fg={theme.textMuted}>{store.collapsed ? "Click to expand" : "Click to collapse"}</text>
          </box>
          <Show when={store.queue.length > 0}>
            <box
              onMouseUp={(evt) => {
                evt.stopPropagation()
                clear()
              }}
            >
              <text fg={theme.textMuted}>Clear queue</text>
            </box>
          </Show>
        </box>
        <Show when={!store.collapsed}>
          <box paddingLeft={3} paddingRight={3} flexDirection="column">
            <For each={visible()}>
              {(item: QueueRow) => {
                const bg = createMemo(() => color(item))
                const fg = createMemo(() =>
                  item.label === "Paused" ? theme.textMuted : selectedForeground(theme, bg()),
                )
                return (
                  <box
                    flexDirection="column"
                    border={["left"]}
                    customBorderChars={SplitBorder.customBorderChars}
                    borderColor={color(item)}
                    paddingLeft={2}
                    marginBottom={1}
                  >
                    <box flexDirection="row" justifyContent="space-between">
                      <text fg={item.label === "Paused" ? theme.textMuted : theme.text}>
                        <span style={{ bg: bg(), fg: fg(), bold: true }}> {item.label} </span>
                        <span style={{ fg: bg(), bold: true }}> {initial(item.agent)} </span>
                        <span> {item.summary}</span>
                      </text>
                      <Show when={item.label === "Queued"}>
                        <box
                          onMouseUp={(evt) => {
                            evt.stopPropagation()
                            remove(item.id)
                          }}
                        >
                          <text fg={theme.textMuted}>remove</text>
                        </box>
                      </Show>
                    </box>
                    <Show when={meta(item)}>
                      <text fg={theme.textMuted}>{meta(item)}</text>
                    </Show>
                  </box>
                )
              }}
            </For>
            <Show when={hidden() > 0}>
              <text fg={theme.textMuted}>... {hidden()} more</text>
            </Show>
          </box>
        </Show>
      </box>
    </Show>
  )
}

const MIME_BADGE: Record<string, string> = {
  "text/plain": "txt",
  "image/png": "img",
  "image/jpeg": "img",
  "image/gif": "img",
  "image/webp": "img",
  "application/pdf": "pdf",
  "application/x-directory": "dir",
}

function UserMessage(props: {
  message: UserMessage
  parts: Part[]
  onMouseUp: () => void
  index: number
  pending?: string
}) {
  const ctx = use()
  const local = useLocal()
  const text = createMemo(() => props.parts.flatMap((x) => (x.type === "text" && !x.synthetic ? [x] : []))[0])
  const files = createMemo(() => props.parts.flatMap((x) => (x.type === "file" ? [x] : [])))
  const sync = useSync()
  const { theme, syntax } = useTheme()
  const segments = createMemo(() => segmentRichText(text()?.text ?? ""))
  const [hover, setHover] = createSignal(false)
  const queued = createMemo(() => props.pending && props.message.id > props.pending)
  const color = createMemo(() => local.agent.color(props.message.agent))
  const selected = createMemo(() => ctx.isHistoryPromptSelected(props.message.id))
  const border = createMemo(() => (selected() ? tint(theme.borderActive, theme.primary, 0.4) : color()))
  const queuedFg = createMemo(() => selectedForeground(theme, color()))
  const metadataVisible = createMemo(() => queued() || ctx.showTimestamps())

  const compaction = createMemo(() => props.parts.find((x) => x.type === "compaction"))

  return (
    <>
      <Show when={text()}>
        <box
          id={props.message.id}
          border={["left"]}
          borderColor={border()}
          customBorderChars={SplitBorder.customBorderChars}
          marginTop={props.index === 0 ? 0 : 1}
        >
          <box
            onMouseOver={() => {
              setHover(true)
            }}
            onMouseOut={() => {
              setHover(false)
            }}
            onMouseUp={props.onMouseUp}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
            flexShrink={0}
          >
            <RichSegments conceal={ctx.conceal()} segments={segments()} syntaxStyle={syntax()} text={theme.text} />
            <Show when={files().length}>
              <box flexDirection="row" paddingBottom={metadataVisible() ? 1 : 0} paddingTop={1} gap={1} flexWrap="wrap">
                <For each={files()}>
                  {(file) => {
                    const bg = createMemo(() => {
                      if (file.mime.startsWith("image/")) return theme.accent
                      if (file.mime === "application/pdf") return theme.primary
                      return theme.secondary
                    })
                    return (
                      <text fg={theme.text}>
                        <span style={{ bg: bg(), fg: theme.background }}> {MIME_BADGE[file.mime] ?? file.mime} </span>
                        <span style={{ bg: theme.backgroundElement, fg: theme.textMuted }}> {file.filename} </span>
                      </text>
                    )
                  }}
                </For>
              </box>
            </Show>
            <Show
              when={queued()}
              fallback={
                <Show when={ctx.showTimestamps()}>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>
                      {Locale.todayTimeOrDateTime(props.message.time.created)}
                    </span>
                  </text>
                </Show>
              }
            >
              <text fg={theme.textMuted}>
                <span style={{ bg: color(), fg: queuedFg(), bold: true }}> QUEUED </span>
              </text>
            </Show>
          </box>
        </box>
      </Show>
      <Show when={compaction()}>
        <box
          marginTop={1}
          border={["top"]}
          title=" Compaction "
          titleAlignment="center"
          borderColor={theme.borderActive}
        />
      </Show>
    </>
  )
}

function AssistantMessage(props: { message: AssistantMessage; parts: Part[]; last: boolean }) {
  const local = useLocal()
  const { theme } = useTheme()
  const sync = useSync()
  const messages = createMemo(() => sync.data.message[props.message.sessionID] ?? [])

  const final = createMemo(() => {
    return props.message.finish && !["tool-calls", "unknown"].includes(props.message.finish)
  })

  const duration = createMemo(() => {
    if (!final()) return 0
    if (!props.message.time.completed) return 0
    const user = messages().find((x) => x.role === "user" && x.id === props.message.parentID)
    if (!user || !user.time) return 0
    return props.message.time.completed - user.time.created
  })

  return (
    <>
      <For each={props.parts}>
        {(part, index) => {
          const component = createMemo(() => PART_MAPPING[part.type as keyof typeof PART_MAPPING])
          return (
            <Show when={component()}>
              <Dynamic
                last={index() === props.parts.length - 1}
                component={component()}
                part={part as any}
                message={props.message}
              />
            </Show>
          )
        }}
      </For>
      <Show when={props.message.error && props.message.error.name !== "MessageAbortedError"}>
        <box
          border={["left"]}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          marginTop={1}
          backgroundColor={theme.backgroundPanel}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.error}
        >
          <text fg={theme.textMuted}>{props.message.error?.data.message}</text>
        </box>
      </Show>
      <Switch>
        <Match when={props.last || final() || props.message.error?.name === "MessageAbortedError"}>
          <box paddingLeft={3}>
            <text marginTop={1}>
              <span
                style={{
                  fg:
                    props.message.error?.name === "MessageAbortedError"
                      ? theme.textMuted
                      : local.agent.color(props.message.agent),
                }}
              >
                ▣{" "}
              </span>{" "}
              <span style={{ fg: theme.text }}>{Locale.titlecase(props.message.mode)}</span>
              <span style={{ fg: theme.textMuted }}> · {props.message.modelID}</span>
              <Show when={duration()}>
                <span style={{ fg: theme.textMuted }}> · {Locale.duration(duration())}</span>
              </Show>
              <Show when={props.message.error?.name === "MessageAbortedError"}>
                <span style={{ fg: theme.textMuted }}> · interrupted</span>
              </Show>
            </text>
          </box>
        </Match>
      </Switch>
    </>
  )
}

const PART_MAPPING = {
  text: TextPart,
  tool: ToolPart,
  reasoning: ReasoningPart,
}

function ReasoningPart(props: { last: boolean; part: ReasoningPart; message: AssistantMessage }) {
  const renderer = useRenderer()
  const { theme, subtleSyntax } = useTheme()
  const ctx = use()
  const [hover, setHover] = createSignal(false)
  const selected = createMemo(() => ctx.isHistoryPartSelected(props.part.id))
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const content = createMemo(() => {
    // Filter out redacted reasoning chunks from OpenRouter
    // OpenRouter sends encrypted reasoning data that appears as [REDACTED]
    return props.part.text.replace("[REDACTED]", "").trim()
  })
  const overflow = createMemo(() => canExpandReasoning(content()))
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return content()
    return clip(content(), REASONING_EXPAND_LINES)
  })

  return (
    <Show when={content() && ctx.showThinking()}>
      <box
        id={"text-" + props.part.id}
        paddingLeft={2}
        marginTop={1}
        flexDirection="column"
        border={["left"]}
        customBorderChars={SplitBorder.customBorderChars}
        borderColor={selected() ? theme.textMuted : theme.backgroundElement}
        backgroundColor={hover() ? theme.backgroundPanel : undefined}
        onMouseOver={() => overflow() && setHover(true)}
        onMouseOut={() => setHover(false)}
        onMouseUp={() => {
          if (!overflow()) return
          if (renderer.getSelection()?.getSelectedText()) return
          ctx.toggleToolExpanded(props.part.id)
        }}
      >
        <code
          filetype="markdown"
          drawUnstyledText={false}
          streaming={true}
          syntaxStyle={subtleSyntax()}
          content={"_Thinking:_ " + limited()}
          conceal={ctx.conceal()}
          fg={theme.textMuted}
        />
        <Show when={overflow()}>
          <text fg={theme.textMuted} paddingLeft={3}>
            {expanded() ? "Click to collapse" : "Click to expand"}
          </text>
        </Show>
      </box>
    </Show>
  )
}

function TextPart(props: { last: boolean; part: TextPart; message: AssistantMessage }) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  const selected = createMemo(() => ctx.isHistoryPartSelected(props.part.id))
  const done = createMemo(() => {
    if (!props.message.finish) return false
    return !["tool-calls", "unknown"].includes(props.message.finish)
  })
  let state: RichTextStream | undefined
  const stream = createMemo(() => {
    state = updateRichTextStream(state, props.part.text, done())
    return state
  })
  const sealed = createMemo(() => stream().sealed)
  const tail = createMemo(() => stream().tail)
  return (
    <Show when={sealed().length || tail().length}>
      <box
        id={"text-" + props.part.id}
        paddingLeft={2}
        marginTop={1}
        flexShrink={0}
        flexDirection="column"
        border={["left"]}
        customBorderChars={SplitBorder.customBorderChars}
        borderColor={selected() ? theme.textMuted : theme.background}
        backgroundColor={selected() ? theme.backgroundElement : undefined}
      >
        <Show when={sealed().length}>
          <RichSegments conceal={ctx.conceal()} segments={sealed()} syntaxStyle={syntax()} text={theme.text} />
        </Show>
        <Show when={tail().length}>
          <RichSegments conceal={ctx.conceal()} segments={tail()} syntaxStyle={syntax()} text={theme.text} />
        </Show>
      </box>
    </Show>
  )
}

// Pending messages moved to individual tool pending functions

function ToolPart(props: { last: boolean; part: ToolPart; message: AssistantMessage }) {
  const ctx = use()
  const sync = useSync()

  // Hide tool if showDetails is false and tool completed successfully
  const shouldHide = createMemo(() => {
    if (ctx.showDetails()) return false
    if (props.part.state.status !== "completed") return false
    return true
  })

  const toolprops = {
    get metadata() {
      return props.part.state.status === "pending" ? {} : (props.part.state.metadata ?? {})
    },
    get input() {
      return props.part.state.input ?? {}
    },
    get output() {
      return props.part.state.status === "completed" ? props.part.state.output : undefined
    },
    get permission() {
      const permissions = sync.data.permission[props.message.sessionID] ?? []
      const permissionIndex = permissions.findIndex((x) => x.tool?.callID === props.part.callID)
      return permissions[permissionIndex]
    },
    get tool() {
      return props.part.tool
    },
    get part() {
      return props.part
    },
  }

  return (
    <Show when={!shouldHide()}>
      <Switch>
        <Match when={props.part.tool === "bash"}>
          <Bash {...toolprops} />
        </Match>
        <Match when={props.part.tool === "glob"}>
          <Glob {...toolprops} />
        </Match>
        <Match when={props.part.tool === "read"}>
          <Read {...toolprops} />
        </Match>
        <Match when={props.part.tool === "grep"}>
          <Grep {...toolprops} />
        </Match>
        <Match when={props.part.tool === "list"}>
          <List {...toolprops} />
        </Match>
        <Match when={props.part.tool === "webfetch"}>
          <WebFetch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "codesearch"}>
          <CodeSearch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "websearch"}>
          <WebSearch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "write"}>
          <Write {...toolprops} />
        </Match>
        <Match when={props.part.tool === "edit"}>
          <Edit {...toolprops} />
        </Match>
        <Match when={props.part.tool === "task"}>
          <Task {...toolprops} />
        </Match>
        <Match when={props.part.tool === "apply_patch"}>
          <ApplyPatch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "todowrite"}>
          <TodoWrite {...toolprops} />
        </Match>
        <Match when={props.part.tool === "question"}>
          <Question {...toolprops} />
        </Match>
        <Match when={props.part.tool === "skill"}>
          <Skill {...toolprops} />
        </Match>
        <Match when={true}>
          <GenericTool {...toolprops} />
        </Match>
      </Switch>
    </Show>
  )
}

type ToolProps<T extends Tool.Info> = {
  input: Partial<Tool.InferParameters<T>>
  metadata: Partial<Tool.InferMetadata<T>>
  permission: Record<string, any>
  tool: string
  output?: string
  part: ToolPart
}
function GenericTool(props: ToolProps<any>) {
  const { theme } = useTheme()
  const ctx = use()
  const output = createMemo(() => props.output?.trim() ?? "")
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const list = createMemo(() => output().split("\n"))
  const overflow = createMemo(() => list().length > GENERIC_EXPAND_LINES)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return [...list().slice(0, GENERIC_EXPAND_LINES), "…"].join("\n")
  })

  return (
    <Show
      when={props.output && ctx.showGenericToolOutput()}
      fallback={
        <InlineTool icon="⚙" pending="Writing command..." complete={true} part={props.part}>
          {props.tool} {input(props.input)}
        </InlineTool>
      }
    >
      <BlockTool
        title={`# ${props.tool} ${input(props.input)}`}
        part={props.part}
        onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
      >
        <box gap={1}>
          <text fg={theme.text}>{limited()}</text>
          <Show when={overflow()}>
            <text fg={theme.textMuted}>{expanded() ? "Click to collapse" : "Click to expand"}</text>
          </Show>
        </box>
      </BlockTool>
    </Show>
  )
}

function ToolTitle(props: { fallback: string; when: any; icon: string; children: JSX.Element }) {
  const { theme } = useTheme()
  return (
    <text paddingLeft={3} fg={props.when ? theme.textMuted : theme.text}>
      <Show fallback={<>~ {props.fallback}</>} when={props.when}>
        <span style={{ bold: true }}>{props.icon}</span> {props.children}
      </Show>
    </text>
  )
}

function InlineTool(props: {
  icon: string
  iconColor?: RGBA
  complete: any
  pending: string
  children: JSX.Element
  part: ToolPart
  onClick?: () => void
}) {
  const renderer = useRenderer()
  const [margin, setMargin] = createSignal(0)
  const [hover, setHover] = createSignal(false)
  const { theme } = useTheme()
  const ctx = use()
  const sync = useSync()

  const permission = createMemo(() => {
    const callID = sync.data.permission[ctx.sessionID]?.at(0)?.tool?.callID
    if (!callID) return false
    return callID === props.part.callID
  })

  const fg = createMemo(() => {
    if (permission()) return theme.warning
    if (props.complete) return theme.textMuted
    return theme.text
  })

  const error = createMemo(() => (props.part.state.status === "error" ? props.part.state.error : undefined))

  const denied = createMemo(
    () =>
      error()?.includes("rejected permission") ||
      error()?.includes("specified a rule") ||
      error()?.includes("user dismissed"),
  )

  const selected = createMemo(() => ctx.isHistoryPartSelected(props.part.id))

  return (
    <box
      id={"tool-" + props.part.id}
      marginTop={margin()}
      border={["left"]}
      borderColor={selected() ? theme.textMuted : theme.background}
      customBorderChars={SplitBorder.customBorderChars}
      paddingLeft={2}
      backgroundColor={hover() ? theme.backgroundMenu : undefined}
      onMouseOver={() => props.onClick && setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return
        props.onClick?.()
      }}
      renderBefore={function () {
        const el = this as BoxRenderable
        const parent = el.parent
        if (!parent) {
          return
        }
        if (el.height > 1) {
          setMargin(1)
          return
        }
        const children = parent.getChildren()
        const index = children.indexOf(el)
        const previous = children[index - 1]
        if (!previous) {
          setMargin(0)
          return
        }
        if (previous.height > 1 || previous.id.startsWith("text-")) {
          setMargin(1)
          return
        }
      }}
    >
      <text paddingLeft={3} fg={fg()} attributes={denied() ? TextAttributes.STRIKETHROUGH : undefined}>
        <Show fallback={<>~ {props.pending}</>} when={props.complete}>
          <span style={{ fg: props.iconColor }}>{props.icon}</span> {props.children}
        </Show>
      </text>
      <Show when={error() && !denied()}>
        <text fg={theme.error}>{error()}</text>
      </Show>
    </box>
  )
}

function BlockTool(props: {
  title: string
  children: JSX.Element
  onClick?: () => void
  part?: ToolPart
  spinner?: boolean
}) {
  const { theme } = useTheme()
  const ctx = use()
  const renderer = useRenderer()
  const [hover, setHover] = createSignal(false)
  const error = createMemo(() => (props.part?.state.status === "error" ? props.part.state.error : undefined))
  const selected = createMemo(() => !!props.part && ctx.isHistoryPartSelected(props.part.id))
  return (
    <box
      id={props.part ? "tool-" + props.part.id : undefined}
      border={["left"]}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      gap={1}
      backgroundColor={hover() ? theme.backgroundMenu : theme.backgroundPanel}
      customBorderChars={SplitBorder.customBorderChars}
      borderColor={selected() ? theme.textMuted : theme.background}
      onMouseOver={() => props.onClick && setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return
        props.onClick?.()
      }}
    >
      <Show
        when={props.spinner}
        fallback={
          <text paddingLeft={3} fg={theme.textMuted}>
            {props.title}
          </text>
        }
      >
        <Spinner color={theme.textMuted}>{props.title.replace(/^# /, "")}</Spinner>
      </Show>
      {props.children}
      <Show when={error()}>
        <text fg={theme.error}>{error()}</text>
      </Show>
    </box>
  )
}

function ExpandableOutputTool(props: {
  icon: string
  pending: string
  complete: any
  title: string
  summary: JSX.Element
  output?: string
  part: ToolPart
  limit?: number
}) {
  const { theme } = useTheme()
  const ctx = use()
  const output = createMemo(() => props.output?.trim() ?? "")
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const limit = createMemo(() => props.limit ?? OUTPUT_EXPAND_LINES)
  const overflow = createMemo(() => lines(output()) > limit())
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return clip(output(), limit())
  })

  return (
    <Switch>
      <Match when={props.output !== undefined && expanded()}>
        <BlockTool
          title={props.title}
          part={props.part}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          <box gap={1}>
            <text fg={theme.text}>{limited()}</text>
            <Show when={overflow()}>
              <text fg={theme.textMuted}>{expanded() ? "Click to collapse" : "Click to expand"}</text>
            </Show>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool
          icon={props.icon}
          pending={props.pending}
          complete={props.complete}
          part={props.part}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          {props.summary}
          <Show when={overflow()}>
            <span style={{ fg: theme.textMuted }}> (click to expand)</span>
          </Show>
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Bash(props: ToolProps<typeof BashTool>) {
  const { theme, syntax } = useTheme()
  const ctx = use()
  const sync = useSync()
  const isRunning = createMemo(() => props.part.state.status === "running")
  const output = createMemo(() => stripAnsi(props.metadata.output?.trim() ?? ""))
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const list = createMemo(() => output().split("\n"))
  const overflow = createMemo(() => list().length > BASH_EXPAND_LINES)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return [...list().slice(0, BASH_EXPAND_LINES), "…"].join("\n")
  })
  const commandSegments = createMemo(() => segmentRichText(`$ ${props.input.command ?? ""}`))
  const outputSegments = createMemo(() => segmentRichText(limited()))

  const workdirDisplay = createMemo(() => {
    const workdir = props.input.workdir
    if (!workdir || workdir === ".") return undefined

    const base = sync.data.path.directory
    if (!base) return undefined

    const absolute = path.resolve(base, workdir)
    if (absolute === base) return undefined

    const home = Global.Path.home
    if (!home) return absolute

    const match = absolute === home || absolute.startsWith(home + path.sep)
    return match ? absolute.replace(home, "~") : absolute
  })

  const title = createMemo(() => {
    const desc = props.input.description ?? "Shell"
    const wd = workdirDisplay()
    if (!wd) return `# ${desc}`
    if (desc.includes(wd)) return `# ${desc}`
    return `# ${desc} in ${wd}`
  })

  return (
    <Switch>
      <Match when={props.metadata.output !== undefined}>
        <BlockTool
          title={title()}
          part={props.part}
          spinner={isRunning()}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          <box gap={1} flexDirection="column">
            <RichSegments
              conceal={ctx.conceal()}
              segments={commandSegments()}
              syntaxStyle={syntax()}
              text={theme.text}
            />
            <Show when={output()}>
              <RichSegments
                conceal={ctx.conceal()}
                segments={outputSegments()}
                syntaxStyle={syntax()}
                text={theme.text}
              />
            </Show>
            <Show when={overflow()}>
              <text fg={theme.textMuted}>{expanded() ? "Click to collapse" : "Click to expand"}</text>
            </Show>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="$" pending="Writing command..." complete={props.input.command} part={props.part}>
          {props.input.command}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Write(props: ToolProps<typeof WriteTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  const code = createMemo(() => {
    if (!props.input.content) return ""
    return props.input.content
  })
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const overflow = createMemo(() => lines(code()) > WRITE_EXPAND_LINES)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return code()
    return clip(code(), WRITE_EXPAND_LINES)
  })

  return (
    <Switch>
      <Match when={props.metadata.diagnostics !== undefined}>
        <BlockTool
          title={"# Wrote " + normalizePath(props.input.filePath!)}
          part={props.part}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          <line_number fg={theme.textMuted} minWidth={3} paddingRight={1}>
            <code
              conceal={false}
              fg={theme.text}
              filetype={filetype(props.input.filePath!)}
              syntaxStyle={syntax()}
              content={limited()}
            />
          </line_number>
          <Show when={overflow()}>
            <text fg={theme.textMuted} paddingLeft={3}>
              {expanded() ? "Click to collapse" : "Click to expand"}
            </text>
          </Show>
          <Diagnostics diagnostics={props.metadata.diagnostics} filePath={props.input.filePath ?? ""} />
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending="Preparing write..." complete={props.input.filePath} part={props.part}>
          Write {normalizePath(props.input.filePath!)}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Glob(props: ToolProps<typeof GlobTool>) {
  return (
    <ExpandableOutputTool
      icon="✱"
      pending="Finding files..."
      complete={props.input.pattern}
      title={`# Glob "${props.input.pattern}"${props.input.path ? ` in ${normalizePath(props.input.path)}` : ""}`}
      output={props.output}
      part={props.part}
      summary={
        <>
          Glob "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
          <Show when={props.metadata.count}>
            ({props.metadata.count} {props.metadata.count === 1 ? "match" : "matches"})
          </Show>
        </>
      }
    />
  )
}

function Read(props: ToolProps<typeof ReadTool>) {
  const { theme } = useTheme()
  const loaded = createMemo(() => {
    if (props.part.state.status !== "completed") return []
    if (props.part.state.time.compacted) return []
    const value = props.metadata.loaded
    if (!value || !Array.isArray(value)) return []
    return value.filter((p): p is string => typeof p === "string")
  })
  return (
    <>
      <ExpandableOutputTool
        icon="→"
        pending="Reading file..."
        complete={props.input.filePath}
        title={"# Read " + normalizePath(props.input.filePath!)}
        output={props.output}
        part={props.part}
        summary={
          <>
            Read {normalizePath(props.input.filePath!)} {input(props.input, ["filePath"])}
          </>
        }
      />
      <For each={loaded()}>
        {(filepath) => (
          <box paddingLeft={3}>
            <text paddingLeft={3} fg={theme.textMuted}>
              ↳ Loaded {normalizePath(filepath)}
            </text>
          </box>
        )}
      </For>
    </>
  )
}

function Grep(props: ToolProps<typeof GrepTool>) {
  return (
    <ExpandableOutputTool
      icon="✱"
      pending="Searching content..."
      complete={props.input.pattern}
      title={`# Grep "${props.input.pattern}"${props.input.path ? ` in ${normalizePath(props.input.path)}` : ""}`}
      output={props.output}
      part={props.part}
      summary={
        <>
          Grep "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
          <Show when={props.metadata.matches}>
            ({props.metadata.matches} {props.metadata.matches === 1 ? "match" : "matches"})
          </Show>
        </>
      }
    />
  )
}

function List(props: ToolProps<typeof ListTool>) {
  const dir = createMemo(() => {
    if (props.input.path) {
      return normalizePath(props.input.path)
    }
    return ""
  })
  return (
    <ExpandableOutputTool
      icon="→"
      pending="Listing directory..."
      complete={props.input.path !== undefined}
      title={"# List " + dir()}
      output={props.output}
      part={props.part}
      summary={<>List {dir()}</>}
    />
  )
}

function WebFetch(props: ToolProps<typeof WebFetchTool>) {
  const input = props.input as any
  return (
    <ExpandableOutputTool
      icon="%"
      pending="Fetching from the web..."
      complete={input.url}
      title={`# WebFetch ${input.url}`}
      output={props.output}
      part={props.part}
      summary={<>WebFetch {input.url}</>}
    />
  )
}

function CodeSearch(props: ToolProps<any>) {
  const input = props.input as any
  const metadata = props.metadata as any
  return (
    <ExpandableOutputTool
      icon="◇"
      pending="Searching code..."
      complete={input.query}
      title={`# Exa Code Search "${input.query}"`}
      output={props.output}
      part={props.part}
      summary={
        <>
          Exa Code Search "{input.query}" <Show when={metadata.results}>({metadata.results} results)</Show>
        </>
      }
    />
  )
}

function WebSearch(props: ToolProps<any>) {
  const input = props.input as any
  const metadata = props.metadata as any
  return (
    <ExpandableOutputTool
      icon="◈"
      pending="Searching web..."
      complete={input.query}
      title={`# Exa Web Search "${input.query}"`}
      output={props.output}
      part={props.part}
      summary={
        <>
          Exa Web Search "{input.query}" <Show when={metadata.numResults}>({metadata.numResults} results)</Show>
        </>
      }
    />
  )
}

function Task(props: ToolProps<typeof TaskTool>) {
  const ctx = use()
  const { theme } = useTheme()
  const keybind = useKeybind()
  const route = useRoute()
  const { navigate } = route
  const local = useLocal()
  const sync = useSync()

  const tools = createMemo(() => {
    const sessionID = props.metadata.sessionId
    const msgs = sync.data.message[sessionID ?? ""] ?? []
    return msgs.flatMap((msg) =>
      (sync.data.part[msg.id] ?? [])
        .filter((part): part is ToolPart => part.type === "tool")
        .map((part) => ({ tool: part.tool, state: part.state })),
    )
  })

  const current = createMemo(() => tools().findLast((x) => x.state.status !== "pending"))
  const isRunning = createMemo(() => props.part.state.status === "running")
  const output = createMemo(() => props.output?.trim() ?? "")
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const overflow = createMemo(() => lines(output()) > OUTPUT_EXPAND_LINES)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return clip(output(), OUTPUT_EXPAND_LINES)
  })

  const open = () => {
    if (!props.metadata.sessionId) return
    navigate({
      type: "session",
      sessionID: props.metadata.sessionId,
      source: "switch",
      workspaceID: route.data.workspaceID,
    })
  }

  return (
    <Switch>
      <Match when={props.input.description || props.input.subagent_type}>
        <BlockTool
          title={"# " + Locale.titlecase(props.input.subagent_type ?? "unknown") + " Task"}
          onClick={
            overflow() ? () => ctx.toggleToolExpanded(props.part.id) : props.metadata.sessionId ? open : undefined
          }
          part={props.part}
          spinner={isRunning()}
        >
          <box gap={1}>
            <text style={{ fg: theme.textMuted }}>
              {props.input.description} ({tools().length} toolcalls)
            </text>
            <Show when={current()}>
              {(item) => {
                const title = item().state.status === "completed" ? (item().state as any).title : ""
                return (
                  <text style={{ fg: item().state.status === "error" ? theme.error : theme.textMuted }}>
                    └ {Locale.titlecase(item().tool)} {title}
                  </text>
                )
              }}
            </Show>
            <Show when={expanded() && output()}>
              <text style={{ fg: theme.text }}>{limited()}</text>
            </Show>
            <Show when={overflow()}>
              <text style={{ fg: theme.textMuted }}>{expanded() ? "Click to collapse" : "Click to expand"}</text>
            </Show>
          </box>
          <Show when={props.metadata.sessionId}>
            <text fg={theme.text}>
              {keybind.print("session_child_first")}
              <span style={{ fg: theme.textMuted }}> view subagents</span>
            </text>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="#" pending="Delegating..." complete={props.input.subagent_type} part={props.part}>
          {props.input.subagent_type} Task {props.input.description}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Edit(props: ToolProps<typeof EditTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()

  const view = createMemo(() => {
    const diffStyle = ctx.tui.diff_style
    if (diffStyle === "stacked") return "unified"
    return ctx.width > 120 ? "split" : "unified"
  })

  const ft = createMemo(() => filetype(props.input.filePath))
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const diff = createMemo(() => props.metadata.diff?.trim() ?? "")
  const overflow = createMemo(() => lines(diff()) > EDIT_EXPAND_LINES)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return diff()
    return clip(diff(), EDIT_EXPAND_LINES)
  })

  return (
    <Switch>
      <Match when={props.metadata.diff !== undefined}>
        <BlockTool
          title={"← Edit " + normalizePath(props.input.filePath!)}
          part={props.part}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          <box paddingLeft={1}>
            <diff
              diff={limited()}
              view={view()}
              filetype={ft()}
              syntaxStyle={syntax()}
              showLineNumbers={true}
              width="100%"
              wrapMode={ctx.diffWrapMode()}
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
          </box>
          <Show when={overflow()}>
            <text fg={theme.textMuted} paddingLeft={3}>
              {expanded() ? "Click to collapse" : "Click to expand"}
            </text>
          </Show>
          <Diagnostics diagnostics={props.metadata.diagnostics} filePath={props.input.filePath ?? ""} />
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending="Preparing edit..." complete={props.input.filePath} part={props.part}>
          Edit {normalizePath(props.input.filePath!)} {input({ replaceAll: props.input.replaceAll })}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function ApplyPatch(props: ToolProps<typeof ApplyPatchTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()

  const files = createMemo(() => props.metadata.files ?? [])
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const overflow = createMemo(
    () =>
      files().reduce((sum, file) => sum + lines(typeof file.diff === "string" ? file.diff : ""), 0) >
      PATCH_EXPAND_LINES,
  )

  const view = createMemo(() => {
    const diffStyle = ctx.tui.diff_style
    if (diffStyle === "stacked") return "unified"
    return ctx.width > 120 ? "split" : "unified"
  })

  function Diff(p: { diff: string; filePath: string }) {
    return (
      <box paddingLeft={1}>
        <diff
          diff={p.diff}
          view={view()}
          filetype={filetype(p.filePath)}
          syntaxStyle={syntax()}
          showLineNumbers={true}
          width="100%"
          wrapMode={ctx.diffWrapMode()}
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
      </box>
    )
  }

  function title(file: { type: string; relativePath: string; filePath: string; deletions: number }) {
    if (file.type === "delete") return "# Deleted " + file.relativePath
    if (file.type === "add") return "# Created " + file.relativePath
    if (file.type === "move") return "# Moved " + normalizePath(file.filePath) + " → " + file.relativePath
    return "← Patched " + file.relativePath
  }

  return (
    <Switch>
      <Match when={files().length > 0}>
        <For each={files()}>
          {(file) => {
            const diff = typeof file.diff === "string" ? file.diff : ""
            return (
              <BlockTool
                title={title(file)}
                part={props.part}
                onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
              >
                <Show
                  when={file.type !== "delete"}
                  fallback={
                    <text fg={theme.diffRemoved}>
                      -{file.deletions} line{file.deletions !== 1 ? "s" : ""}
                    </text>
                  }
                >
                  <Diff
                    diff={expanded() || !overflow() ? diff : clip(diff, PATCH_FILE_PREVIEW_LINES)}
                    filePath={file.filePath}
                  />
                  <Diagnostics diagnostics={props.metadata.diagnostics} filePath={file.movePath ?? file.filePath} />
                </Show>
                <Show when={overflow()}>
                  <text fg={theme.textMuted} paddingLeft={3}>
                    {expanded() ? "Click to collapse" : "Click to expand"}
                  </text>
                </Show>
              </BlockTool>
            )
          }}
        </For>
      </Match>
      <Match when={true}>
        <InlineTool icon="%" pending="Preparing patch..." complete={false} part={props.part}>
          Patch
        </InlineTool>
      </Match>
    </Switch>
  )
}

function TodoWrite(props: ToolProps<typeof TodoWriteTool>) {
  const { theme } = useTheme()
  const ctx = use()
  const todos = createMemo(() => props.input.todos ?? [])
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const overflow = createMemo(() => todos().length > TODO_EXPAND_ITEMS)
  const visible = createMemo(() => {
    if (expanded() || !overflow()) return todos()
    return todos().slice(0, TODO_EXPAND_ITEMS)
  })

  return (
    <Switch>
      <Match when={props.metadata.todos?.length}>
        <BlockTool
          title="# Todos"
          part={props.part}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          <box>
            <For each={visible()}>{(todo) => <TodoItem status={todo.status} content={todo.content} />}</For>
            <Show when={overflow() && !expanded()}>
              <text fg={theme.textMuted} paddingLeft={3}>
                … {todos().length - TODO_EXPAND_ITEMS} more
              </text>
            </Show>
          </box>
          <Show when={overflow()}>
            <text fg={theme.textMuted} paddingLeft={3}>
              {expanded() ? "Click to collapse" : "Click to expand"}
            </text>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="⚙" pending="Updating todos..." complete={false} part={props.part}>
          Updating todos...
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Question(props: ToolProps<typeof QuestionTool>) {
  const { theme } = useTheme()
  const ctx = use()
  const count = createMemo(() => props.input.questions?.length ?? 0)
  const expanded = createMemo(() => ctx.isToolExpanded(props.part.id))
  const rows = createMemo(() =>
    (props.input.questions ?? []).map((question, index) => ({
      question: question.question,
      answer: props.metadata.answers?.[index],
    })),
  )
  const overflow = createMemo(() => rows().length > QUESTION_EXPAND_ITEMS)
  const visible = createMemo(() => {
    if (expanded() || !overflow()) return rows()
    return rows().slice(0, QUESTION_EXPAND_ITEMS)
  })

  function format(answer?: string[]) {
    if (!answer?.length) return "(no answer)"
    return answer.join(", ")
  }

  return (
    <Switch>
      <Match when={props.metadata.answers}>
        <BlockTool
          title="# Questions"
          part={props.part}
          onClick={overflow() ? () => ctx.toggleToolExpanded(props.part.id) : undefined}
        >
          <box gap={1}>
            <For each={visible()}>
              {(item) => (
                <box flexDirection="column">
                  <text fg={theme.textMuted}>{item.question}</text>
                  <text fg={theme.text}>{format(item.answer)}</text>
                </box>
              )}
            </For>
            <Show when={overflow() && !expanded()}>
              <text fg={theme.textMuted} paddingLeft={3}>
                … {rows().length - QUESTION_EXPAND_ITEMS} more
              </text>
            </Show>
          </box>
          <Show when={overflow()}>
            <text fg={theme.textMuted} paddingLeft={3}>
              {expanded() ? "Click to collapse" : "Click to expand"}
            </text>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="→" pending="Asking questions..." complete={count()} part={props.part}>
          Asked {count()} question{count() !== 1 ? "s" : ""}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Skill(props: ToolProps<typeof SkillTool>) {
  return (
    <ExpandableOutputTool
      icon="→"
      pending="Loading skill..."
      complete={props.input.name}
      title={`# Skill "${props.input.name}"`}
      output={props.output}
      part={props.part}
      summary={<>Skill "{props.input.name}"</>}
    />
  )
}

function Diagnostics(props: { diagnostics?: Record<string, Record<string, any>[]>; filePath: string }) {
  const { theme } = useTheme()
  const errors = createMemo(() => {
    const normalized = Filesystem.normalizePath(props.filePath)
    const arr = props.diagnostics?.[normalized] ?? []
    return arr.filter((x) => x.severity === 1).slice(0, 3)
  })

  return (
    <Show when={errors().length}>
      <box>
        <For each={errors()}>
          {(diagnostic) => (
            <text fg={theme.error}>
              Error [{diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}] {diagnostic.message}
            </text>
          )}
        </For>
      </box>
    </Show>
  )
}

function normalizePath(input?: string) {
  if (!input) return ""
  if (path.isAbsolute(input)) {
    return path.relative(process.cwd(), input) || "."
  }
  return input
}

function input(input: Record<string, any>, omit?: string[]): string {
  const primitives = Object.entries(input).filter(([key, value]) => {
    if (omit?.includes(key)) return false
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  })
  if (primitives.length === 0) return ""
  return `[${primitives.map(([key, value]) => `${key}=${value}`).join(", ")}]`
}

function filetype(input?: string) {
  if (!input) return "none"
  const ext = path.extname(input)
  const language = LANGUAGE_EXTENSIONS[ext]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}
