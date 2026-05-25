import type { Message } from "@slopcode-ai/sdk/v2/client"

export const messageBatchSize = 20

export function messagePartsComplete(messages: Message[] | undefined, part: Record<string, unknown[] | undefined>) {
  if (!messages) return false
  return messages.every((message) => part[message.id] !== undefined)
}

export function messageBatches(
  messages: Message[],
  part: Record<string, unknown[] | undefined>,
  size = messageBatchSize,
) {
  const pending = messages.filter((message) => part[message.id] === undefined).map((message) => message.id)
  const out: string[][] = []
  for (let i = pending.length; i > 0; i -= size) {
    out.push(pending.slice(Math.max(0, i - size), i))
  }
  return out
}
