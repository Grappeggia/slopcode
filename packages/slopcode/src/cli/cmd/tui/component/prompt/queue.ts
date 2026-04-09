import { createSerialQueue } from "@slopcode-ai/util/serial-queue"

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
  reject: (error: unknown) => void
}

const SUMMARY_MAX = 250

const short = (value: string, limit = SUMMARY_MAX) => {
  const text = value.replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (text.length <= limit) return text
  return text.slice(0, limit - 3).trimEnd() + "..."
}

const count = (value: number, label: string) => `${value} ${label}${value === 1 ? "" : "s"}`

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
