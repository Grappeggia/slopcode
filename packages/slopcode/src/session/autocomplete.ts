import { Instance } from "@/project/instance"
import { Session } from "."
import type { MessageV2 } from "./message-v2"

const SESSION_LIMIT = 3
const PROMPT_LIMIT = 4

const state = Instance.state(() => ({
  related: new Map<string, string>(),
  loading: new Map<string, Promise<string>>(),
}))

function text(parts: MessageV2.Part[]) {
  return parts
    .flatMap((part) => {
      if (part.type !== "text") return []
      if (part.synthetic || part.ignored) return []
      const value = part.text.trim()
      if (!value) return []
      return [value]
    })
    .join("\n")
    .trim()
}
function latest(messages: MessageV2.WithParts[]) {
  return messages.slice().sort((a, b) => b.info.time.created - a.info.time.created)
}

function prompts(messages: MessageV2.WithParts[]) {
  return latest(messages).flatMap((message) => {
    if (message.info.role !== "user") return []
    const prompt = text(message.parts)
    if (!prompt) return []
    return [
      {
        id: message.info.id,
        prompt,
        system: message.info.system?.trim() || undefined,
      },
    ]
  })
}

function replies(messages: MessageV2.WithParts[]) {
  return latest(messages)
    .flatMap((message) => {
      if (message.info.role !== "assistant") return []
      const value = text(message.parts)
      if (!value) return []
      return [[message.info.parentID, value] as const]
    })
    .reduce((map, item) => {
      if (map.has(item[0])) return map
      map.set(item[0], item[1])
      return map
    }, new Map<string, string>())
}

function section(index: number, value: string) {
  return [`<PROMPT index="${index}">`, value, "</PROMPT>"]
}

async function related(sessionID: string) {
  const current = await Session.get(sessionID)
  const sessions = [] as Session.Info[]
  const iter = Session.list({ directory: current.directory })
  while (sessions.length < SESSION_LIMIT) {
    const next = iter.next()
    const session = next.value
    if (next.done || !session) break
    if (session.id === sessionID || session.time.archived) continue
    sessions.push(session)
  }

  const data = await Promise.all(
    sessions.map(async (session) => {
      const values = prompts(await Session.messages({ sessionID: session.id }))
        .map((item) => item.prompt)
        .slice(0, PROMPT_LIMIT)
      if (values.length === 0) return
      return {
        id: session.id,
        title: session.title,
        prompts: values,
      }
    }),
  )

  const list = data.filter((item): item is NonNullable<(typeof data)[number]> => !!item)
  if (list.length === 0) return ""

  return [
    "<RELATED_SESSION_PROMPTS>",
    ...list.flatMap((item, index) => [
      `<SESSION index="${index + 1}">`,
      `<SESSION_ID>${item.id}</SESSION_ID>`,
      `<SESSION_TITLE>${item.title}</SESSION_TITLE>`,
      ...item.prompts.flatMap((prompt, promptIndex) => section(promptIndex + 1, prompt)),
      "</SESSION>",
    ]),
    "</RELATED_SESSION_PROMPTS>",
  ].join("\n")
}

export namespace SessionAutocomplete {
  export function request(prefix: string, min: number) {
    if (!/\S/.test(prefix)) return false
    if (prefix.length < min) return false
    return true
  }

  export function context(input: { messages: MessageV2.WithParts[]; related: string }) {
    const user = prompts(input.messages)
    const assistant = replies(input.messages)
    const system = user.find((item) => !!item.system)?.system
    const current = user[0] ? assistant.get(user[0].id) : undefined
    const previous = user[1] ? assistant.get(user[1].id) : undefined

    const lines = [
      "Use this context to improve autocomplete precision.",
      "<CURRENT_SESSION_USER_PROMPTS_LATEST_FIRST>",
      ...user.flatMap((item, index) => section(index + 1, item.prompt)),
      "</CURRENT_SESSION_USER_PROMPTS_LATEST_FIRST>",
    ]

    if (current || previous) {
      lines.push("<RECENT_AGENT_TEXT_RESPONSES>")
      if (current) lines.push(...section(1, current))
      if (previous) lines.push(...section(2, previous))
      lines.push("</RECENT_AGENT_TEXT_RESPONSES>")
    }

    if (input.related) lines.push(input.related)

    return {
      system,
      prompt: lines.join("\n"),
    }
  }

  export function spacing(prefix: string, completion: string) {
    if (!prefix || !completion) return completion
    if (!/\S/.test(prefix)) return completion
    if (/\s$/.test(prefix)) return completion
    if (/^\s/.test(completion)) return completion
    const left = prefix[prefix.length - 1] ?? ""
    const right = completion[0] ?? ""
    if (!/[A-Za-z0-9_]/.test(left)) return completion
    if (!/[A-Za-z0-9_-]/.test(right)) return completion
    return ` ${completion}`
  }

  export async function warm(sessionID: string) {
    const cache = state()
    const cached = cache.related.get(sessionID)
    if (cached !== undefined) return cached

    const loading = cache.loading.get(sessionID)
    if (loading) return loading

    const job = related(sessionID)
      .then((value) => {
        cache.related.set(sessionID, value)
        cache.loading.delete(sessionID)
        return value
      })
      .catch((error) => {
        cache.loading.delete(sessionID)
        throw error
      })

    cache.loading.set(sessionID, job)
    return job
  }

  export function begin(sessionID: string) {
    warm(sessionID).catch(() => {})
  }
}
