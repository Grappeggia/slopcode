import { createSimpleContext } from "@slopcode-ai/ui/context"
import { checksum } from "@slopcode-ai/core/util/encode"
import { useParams, useSearchParams } from "@solidjs/router"
import { batch, createMemo, createRoot, getOwner, onCleanup } from "solid-js"
import { createStore, type SetStoreFunction } from "solid-js/store"
import type { FileSelection } from "@/context/file"
import { Persist, persisted } from "@/utils/persist"
import { useServerSDK } from "./server-sdk"
import type { ServerScope } from "@/utils/server-scope"

interface PartBase {
  content: string
  start: number
  end: number
}

export interface TextPart extends PartBase {
  type: "text"
}

export interface FileAttachmentPart extends PartBase {
  type: "file"
  path: string
  selection?: FileSelection
}

export interface AgentPart extends PartBase {
  type: "agent"
  name: string
}

export interface ImageAttachmentPart {
  type: "image"
  id: string
  filename: string
  mime: string
  dataUrl: string
}

export type ContentPart = TextPart | FileAttachmentPart | AgentPart | ImageAttachmentPart
export type Prompt = ContentPart[]

export type FileContextItem = {
  type: "file"
  path: string
  selection?: FileSelection
  comment?: string
  commentID?: string
  commentOrigin?: "review" | "file"
  preview?: string
}

export type ContextItem = FileContextItem

export type PromptMode = "normal" | "shell"

export type PromptSnapshot = {
  prompt: Prompt
  cursor: number | undefined
  context: (ContextItem & { key: string })[]
  mode: PromptMode
}

export const DEFAULT_PROMPT: Prompt = [{ type: "text", content: "", start: 0, end: 0 }]

function isSelectionEqual(a?: FileSelection, b?: FileSelection) {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.startLine === b.startLine && a.startChar === b.startChar && a.endLine === b.endLine && a.endChar === b.endChar
  )
}

function isPartEqual(partA: ContentPart, partB: ContentPart) {
  switch (partA.type) {
    case "text":
      return partB.type === "text" && partA.content === partB.content
    case "file":
      return partB.type === "file" && partA.path === partB.path && isSelectionEqual(partA.selection, partB.selection)
    case "agent":
      return partB.type === "agent" && partA.name === partB.name
    case "image":
      return partB.type === "image" && partA.id === partB.id
  }
}

export function isPromptEqual(promptA: Prompt, promptB: Prompt): boolean {
  if (promptA.length !== promptB.length) return false
  for (let i = 0; i < promptA.length; i++) {
    if (!isPartEqual(promptA[i], promptB[i])) return false
  }
  return true
}

function cloneSelection(selection?: FileSelection) {
  if (!selection) return undefined
  return { ...selection }
}

function clonePart(part: ContentPart): ContentPart {
  if (part.type === "text") return { ...part }
  if (part.type === "image") return { ...part }
  if (part.type === "agent") return { ...part }
  return {
    ...part,
    selection: cloneSelection(part.selection),
  }
}

export function clonePrompt(prompt: Prompt): Prompt {
  return prompt.map(clonePart)
}

function cloneContext(context: (ContextItem & { key: string })[]) {
  return context.map((item) => ({
    ...item,
    selection: cloneSelection(item.selection),
  }))
}

function contextItemKey(item: ContextItem) {
  if (item.type !== "file") return item.type
  const start = item.selection?.startLine
  const end = item.selection?.endLine
  const key = `${item.type}:${item.path}:${start}:${end}`

  if (item.commentID) {
    return `${key}:c=${item.commentID}`
  }

  const comment = item.comment?.trim()
  if (!comment) return key
  const digest = checksum(comment) ?? comment
  return `${key}:c=${digest.slice(0, 8)}`
}

function isCommentItem(item: ContextItem | (ContextItem & { key: string })) {
  return item.type === "file" && !!item.comment?.trim()
}

function createPromptActions(
  setStore: SetStoreFunction<{
    prompt: Prompt
    cursor?: number
    context: {
      items: (ContextItem & { key: string })[]
    }
    mode: PromptMode
  }>,
) {
  return {
    set(prompt: Prompt, cursorPosition?: number) {
      const next = clonePrompt(prompt)
      batch(() => {
        setStore("prompt", next)
        if (cursorPosition !== undefined) setStore("cursor", cursorPosition)
      })
    },
    reset() {
      batch(() => {
        setStore("prompt", clonePrompt(DEFAULT_PROMPT))
        setStore("cursor", 0)
      })
    },
  }
}

const WORKSPACE_KEY = "__workspace__"
const MAX_PROMPT_SESSIONS = 20

type PromptSession = ReturnType<typeof createPromptSession>

export type PromptScope = { draftID: string } | { dir: string; id?: string }

function scopeKey(scope: PromptScope) {
  if ("draftID" in scope) return `draft:${scope.draftID}`
  return `${scope.dir}:${scope.id ?? WORKSPACE_KEY}`
}

type PromptCacheEntry = {
  value: PromptSession
  dispose: VoidFunction
}

function promptTarget(serverScope: ServerScope, scope: PromptScope) {
  if ("draftID" in scope) return Persist.draft(scope.draftID, "prompt")
  const legacy = `${scope.dir}/prompt${scope.id ? "/" + scope.id : ""}.v2`
  return Persist.serverScoped(serverScope, scope.dir, scope.id, "prompt", [legacy])
}

function createPromptSession(serverScope: ServerScope, scope: PromptScope) {
  const [store, setStore, _, ready] = persisted(
    promptTarget(serverScope, scope),
    createStore<{
      prompt: Prompt
      cursor?: number
      context: {
        items: (ContextItem & { key: string })[]
      }
      mode: PromptMode
    }>({
      prompt: clonePrompt(DEFAULT_PROMPT),
      cursor: undefined,
      context: {
        items: [],
      },
      mode: "normal",
    }),
  )

  const actions = createPromptActions(setStore)

  return {
    ready,
    current: () => store.prompt,
    cursor: createMemo(() => store.cursor),
    dirty: () => !isPromptEqual(store.prompt, DEFAULT_PROMPT),
    mode: () => store.mode,
    snapshot: (): PromptSnapshot => ({
      prompt: clonePrompt(store.prompt),
      cursor: store.cursor,
      context: cloneContext(store.context.items),
      mode: store.mode,
    }),
    replace(snapshot: PromptSnapshot) {
      batch(() => {
        setStore("prompt", clonePrompt(snapshot.prompt))
        setStore("cursor", snapshot.cursor)
        setStore("context", "items", cloneContext(snapshot.context))
        setStore("mode", snapshot.mode)
      })
    },
    setMode(mode: PromptMode) {
      setStore("mode", mode)
    },
    context: {
      items: createMemo(() => store.context.items),
      add(item: ContextItem) {
        const key = contextItemKey(item)
        if (store.context.items.find((x) => x.key === key)) return
        setStore("context", "items", (items) => [...items, { key, ...item }])
      },
      remove(key: string) {
        setStore("context", "items", (items) => items.filter((x) => x.key !== key))
      },
      removeComment(path: string, commentID: string) {
        setStore("context", "items", (items) =>
          items.filter((item) => !(item.type === "file" && item.path === path && item.commentID === commentID)),
        )
      },
      updateComment(path: string, commentID: string, next: Partial<FileContextItem> & { comment?: string }) {
        setStore("context", "items", (items) =>
          items.map((item) => {
            if (item.type !== "file" || item.path !== path || item.commentID !== commentID) return item
            const value = { ...item, ...next }
            return { ...value, key: contextItemKey(value) }
          }),
        )
      },
      replaceComments(items: FileContextItem[]) {
        setStore("context", "items", (current) => [
          ...current.filter((item) => !isCommentItem(item)),
          ...items.map((item) => ({ ...item, key: contextItemKey(item) })),
        ])
      },
    },
    set: actions.set,
    reset: actions.reset,
  }
}

export const { use: usePrompt, provider: PromptProvider } = createSimpleContext({
  name: "Prompt",
  gate: false,
  init: () => {
    const params = useParams()
    const [search] = useSearchParams<{ draftId?: string }>()
    const serverSDK = useServerSDK()
    const cache = new Map<string, PromptCacheEntry>()

    const disposeAll = () => {
      for (const entry of cache.values()) {
        entry.dispose()
      }
      cache.clear()
    }

    onCleanup(disposeAll)

    const prune = () => {
      while (cache.size > MAX_PROMPT_SESSIONS) {
        const first = cache.keys().next().value
        if (!first) return
        const entry = cache.get(first)
        entry?.dispose()
        cache.delete(first)
      }
    }

    const owner = getOwner()
    const load = (scope: PromptScope) => {
      const key = scopeKey(scope)
      const existing = cache.get(key)
      if (existing) {
        cache.delete(key)
        cache.set(key, existing)
        return existing.value
      }

      const entry = createRoot(
        (dispose) => ({
          value: createPromptSession(serverSDK.scope, scope),
          dispose,
        }),
        owner,
      )

      cache.set(key, entry)
      prune()
      return entry.value
    }

    const session = createMemo(() =>
      load(search.draftId ? { draftID: search.draftId } : { dir: params.dir!, id: params.id }),
    )
    const pick = (scope?: PromptScope) => (scope ? load(scope) : session())

    return {
      ready: () => session().ready,
      current: () => session().current(),
      cursor: () => session().cursor(),
      dirty: () => session().dirty(),
      mode: () => session().mode(),
      snapshot: (scope?: PromptScope) => pick(scope).snapshot(),
      context: {
        items: () => session().context.items(),
        add: (item: ContextItem) => session().context.add(item),
        remove: (key: string) => session().context.remove(key),
        removeComment: (path: string, commentID: string) => session().context.removeComment(path, commentID),
        updateComment: (path: string, commentID: string, next: Partial<FileContextItem> & { comment?: string }) =>
          session().context.updateComment(path, commentID, next),
        replaceComments: (items: FileContextItem[]) => session().context.replaceComments(items),
      },
      set: (prompt: Prompt, cursorPosition?: number, scope?: PromptScope) => pick(scope).set(prompt, cursorPosition),
      reset: (scope?: PromptScope) => pick(scope).reset(),
      replace: (snapshot: PromptSnapshot, scope?: PromptScope) => pick(scope).replace(snapshot),
      setMode: (mode: PromptMode, scope?: PromptScope) => pick(scope).setMode(mode),
    }
  },
})
