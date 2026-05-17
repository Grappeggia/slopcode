import { createSerialQueue } from "@slopcode-ai/util/serial-queue"
import type { Message } from "@slopcode-ai/sdk/v2"

export type PromptQueueItem = {
  key: string
  id: string
  mode: "normal" | "shell"
  agent: string
  summary: string
  detail?: string
  time: {
    queued: number
    started?: number
  }
  ready: () => boolean
  done: () => boolean
  run: () => Promise<void>
  refresh?: () => Promise<void> | void
  reject: (error: unknown) => void
}

export type PromptQueueStore = {
  message: {
    [sessionID: string]: Message[] | undefined
  }
  session_status: {
    [sessionID: string]: { type: string } | undefined
  }
}

const SUMMARY_MAX = 250

const short = (value: string, limit = SUMMARY_MAX) => {
  const text = value.replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (text.length <= limit) return text
  return text.slice(0, limit - 3).trimEnd() + "..."
}

const count = (value: number, label: string) => `${value} ${label}${value === 1 ? "" : "s"}`

export const promptQueueIdle = (store: PromptQueueStore, sessionID: string) =>
  (store.session_status[sessionID]?.type ?? "idle") === "idle"

const terminal = (message: Message) => {
  if (message.role !== "assistant") return false
  if (!message.time.completed) return false
  if (message.error) return true
  if (!message.finish) return false
  return !["tool-calls", "unknown"].includes(message.finish)
}

export const promptQueueDone = (store: PromptQueueStore, sessionID: string, messageID: string) => {
  return (store.message[sessionID] ?? [])
    .filter((item) => item.role === "assistant" && item.parentID === messageID)
    .some(terminal)
}

export const promptQueueReady = (store: PromptQueueStore, sessionID: string) => promptQueueIdle(store, sessionID)

export const promptQueue = createSerialQueue<PromptQueueItem>()

export function describePromptQueue(input: { text: string; files?: number }) {
  const summary = short(input.text)
  const detail = input.files ? count(input.files, "file") : undefined

  if (summary) {
    return {
      summary,
      detail,
    }
  }

  return {
    summary: detail || "Queued prompt",
    detail: undefined,
  }
}
