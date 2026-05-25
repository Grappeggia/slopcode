import { createHash } from "crypto"
import path from "path"
import { readFileSync } from "fs"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { createStore, produce, type SetStoreFunction, type Store, unwrap } from "solid-js/store"
import type { AgentPart, FilePart, TextPart } from "@slopcode-ai/sdk/v2"

export type PromptInfo = {
  input: string
  mode?: "normal" | "shell"
  parts: (
    | Omit<FilePart, "id" | "messageID" | "sessionID">
    | Omit<AgentPart, "id" | "messageID" | "sessionID">
    | (Omit<TextPart, "id" | "messageID" | "sessionID"> & {
        source?: {
          text: {
            start: number
            end: number
            value: string
          }
        }
      })
  )[]
}

export type PromptHistoryScope = {
  dir: string
  sessionID?: string
}

type PromptHistoryState = {
  index: number
  draft: PromptInfo
  history: PromptInfo[]
}

const MAX_HISTORY_ENTRIES = 50
const DRAFT_ID = "__draft__"

const blank = (): PromptInfo => ({
  input: "",
  parts: [],
  mode: "normal",
})

const clone = (input?: PromptInfo) => structuredClone(unwrap(input ?? blank()))

const isPromptInfo = (value: unknown): value is PromptInfo => {
  if (typeof value !== "object" || value === null) return false
  if (!("input" in value) || typeof value.input !== "string") return false
  if (!("parts" in value) || !Array.isArray(value.parts)) return false
  if (!("mode" in value) || value.mode === undefined) return true
  return value.mode === "normal" || value.mode === "shell"
}

export const promptHistoryScope = (input?: PromptHistoryScope): PromptHistoryScope => ({
  dir: input?.dir || process.cwd(),
  sessionID: input?.sessionID,
})

const id = (input: PromptHistoryScope) => input.sessionID ?? DRAFT_ID

export const promptHistoryKey = (input?: PromptHistoryScope) => {
  const value = promptHistoryScope(input)
  return `${value.dir}:${id(value)}`
}

export function promptHistoryPath(input?: PromptHistoryScope, root = Global.Path.state) {
  const value = promptHistoryScope(input)
  return path.join(root, "prompt-history", createHash("sha256").update(value.dir).digest("hex"), `${id(value)}.jsonl`)
}

export function readPromptHistory(filePath: string) {
  const text = (() => {
    try {
      return readFileSync(filePath, "utf-8")
    } catch {
      return ""
    }
  })()

  let dirty = false
  const parsed = text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        dirty = true
        return []
      }
    })

  const valid = parsed.filter(isPromptInfo)
  if (valid.length !== parsed.length) dirty = true

  const history = valid.slice(-MAX_HISTORY_ENTRIES)
  if (history.length !== valid.length) dirty = true
  return { history, dirty }
}

export function writePromptHistory(filePath: string, history: PromptInfo[]) {
  const content = history.length > 0 ? history.map((line) => JSON.stringify(line)).join("\n") + "\n" : ""
  return Filesystem.write(filePath, content)
}

function createPromptHistoryState(history: PromptInfo[] = []): PromptHistoryState {
  return {
    index: 0,
    draft: blank(),
    history,
  }
}

function createPromptHistorySessionState(
  store: Store<PromptHistoryState>,
  setStore: SetStoreFunction<PromptHistoryState>,
  persist?: VoidFunction,
) {
  return {
    has() {
      return store.history.length > 0
    },
    list() {
      return store.history
    },
    move(direction: 1 | -1, item: PromptInfo) {
      if (!store.history.length) return undefined

      const current = store.history.at(store.index)
      const match =
        current &&
        current.input === item.input &&
        current.mode === item.mode &&
        Bun.deepEquals(current.parts, item.parts)

      if (direction === -1) {
        if (!match) {
          setStore("draft", clone(item))
          setStore("index", -1)
          return store.history.at(-1)
        }

        const next = Math.max(-store.history.length, store.index - 1)
        if (next === store.index) return store.history.at(store.index)
        setStore("index", next)
        return store.history.at(next)
      }

      if (store.index === 0) return undefined
      const next = Math.min(0, store.index + 1)
      setStore("index", next)
      if (next === 0) return store.draft
      return store.history.at(next)
    },
    append(item: PromptInfo) {
      const entry = clone(item)
      setStore(
        produce((draft) => {
          draft.history.push(entry)
          if (draft.history.length > MAX_HISTORY_ENTRIES) {
            draft.history = draft.history.slice(-MAX_HISTORY_ENTRIES)
          }
          draft.draft = blank()
          draft.index = 0
        }),
      )
      persist?.()
    },
  }
}

export function createPromptHistorySession(filePath: string, history: PromptInfo[]) {
  const [store, setStore] = createStore<PromptHistoryState>(createPromptHistoryState(history))
  return createPromptHistorySessionState(store, setStore, () => {
    void writePromptHistory(filePath, store.history).catch(() => {})
  })
}

export function createPromptHistorySessionForTest(history: PromptInfo[] = []) {
  const [store, setStore] = createStore<PromptHistoryState>(createPromptHistoryState(history))
  return createPromptHistorySessionState(store, setStore)
}
