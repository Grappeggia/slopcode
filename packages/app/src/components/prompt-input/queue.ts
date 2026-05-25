import { createSerialQueue } from "@slopcode-ai/util/serial-queue"

export type PromptQueueItem = {
  key: string
  id: string
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

const short = (value: string, limit = 72) => {
  const text = value.replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (text.length <= limit) return text
  return text.slice(0, limit - 3).trimEnd() + "..."
}

const count = (value: number, label: string) => `${value} ${label}${value === 1 ? "" : "s"}`

export const promptQueueKey = (directory: string, sessionID: string) => `${directory}\n${sessionID}`

export const promptQueue = createSerialQueue<PromptQueueItem>()

export function describePromptQueue(input: { text: string; images?: number; comments?: number }) {
  const summary = short(input.text)
  const detail = [
    input.images ? count(input.images, "image") : undefined,
    input.comments ? count(input.comments, "comment") : undefined,
  ]
    .filter((item): item is string => !!item)
    .join(" - ")

  if (summary) {
    return {
      summary,
      detail: detail || undefined,
    }
  }

  return {
    summary: detail || "Queued prompt",
    detail: undefined,
  }
}
