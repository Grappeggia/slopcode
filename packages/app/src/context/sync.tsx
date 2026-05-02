import { batch, createMemo } from "solid-js"
import { createStore, produce, reconcile } from "solid-js/store"
import { Binary } from "@slopcode-ai/util/binary"
import { retry } from "@slopcode-ai/util/retry"
import { createSimpleContext } from "@slopcode-ai/ui/context"
import { useGlobalSync } from "./global-sync"
import { diffBatches, diffComplete as diffReady, mergeDiffs } from "./session-diff"
import { messageBatches, messagePartsComplete } from "./session-message"
import { useSDK } from "./sdk"
import type { Message, Part } from "@slopcode-ai/sdk/v2/client"
import { setOptimisticAdd, setOptimisticRemove, sortParts } from "./sync-optimistic"
import type { SessionHistory } from "./global-sync/types"

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function runInflight(map: Map<string, Promise<void>>, key: string, task: () => Promise<void>) {
  const pending = map.get(key)
  if (pending) return pending
  const promise = task().finally(() => {
    map.delete(key)
  })
  map.set(key, promise)
  return promise
}

const keyFor = (directory: string, id: string) => `${directory}\n${id}`

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      queueMicrotask(resolve)
      return
    }
    requestAnimationFrame(() => resolve())
  })

const afterPaint = async () => {
  await nextFrame()
  await nextFrame()
}

export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync",
  init: () => {
    const globalSync = useGlobalSync()
    const sdk = useSDK()

    type Child = ReturnType<(typeof globalSync)["child"]>
    type Setter = Child[1]

    const current = createMemo(() => globalSync.child(sdk.directory))
    const target = (directory?: string) => {
      if (!directory || directory === sdk.directory) return current()
      return globalSync.child(directory)
    }
    const absolute = (path: string) => (current()[0].path.directory + "/" + path).replace("//", "/")
    const messagePageSize = 400
    const inflight = new Map<string, Promise<void>>()
    const inflightMessageHydrate = new Map<string, Promise<void>>()
    const inflightDiff = new Map<string, Promise<void>>()
    const inflightDiffHydrate = new Map<string, Promise<void>>()
    const inflightTodo = new Map<string, Promise<void>>()
    const [meta, setMeta] = createStore({
      loading: {} as Record<string, boolean>,
    })

    const getSession = (sessionID: string) => {
      const store = current()[0]
      const match = Binary.search(store.session, sessionID, (s) => s.id)
      if (match.found) return store.session[match.index]
      return undefined
    }

    const limitFor = (count: number) => {
      if (count <= messagePageSize) return messagePageSize
      return Math.ceil(count / messagePageSize) * messagePageSize
    }

    const persistHistory = (directory: string, sessionID: string, store: Child[0]) => {
      const messages = store.message[sessionID]
      const history = store.history[sessionID]
      if (!messages || !history) {
        globalSync.history.write(directory, sessionID, undefined)
        return
      }

      globalSync.history.write(directory, sessionID, {
        message: messages,
        part: Object.fromEntries(
          messages.flatMap((message) => {
            const parts = store.part[message.id]
            if (parts === undefined) return []
            return [[message.id, sortParts(parts)] as const]
          }),
        ),
        limit: history.limit,
        complete: history.complete,
      } satisfies SessionHistory)
    }

    const fetchMessageIndex = async (input: { client: typeof sdk.client; sessionID: string; limit: number }) => {
      const messages = await retry(() =>
        input.client.session.messageIndex({ sessionID: input.sessionID, limit: input.limit }),
      )
      const items = (messages.data ?? []).filter((message) => !!message?.id).sort((a, b) => cmp(a.id, b.id))
      return {
        session: items,
        complete: items.length < input.limit,
      }
    }

    const hydrateMessages = async (input: {
      directory: string
      client: typeof sdk.client
      setStore: Setter
      store: Child[0]
      sessionID: string
    }) => {
      const key = keyFor(input.directory, input.sessionID)
      return runInflight(inflightMessageHydrate, key, async () => {
        await afterPaint()

        for (;;) {
          const messages = input.store.message[input.sessionID] ?? []
          if (messagePartsComplete(messages, input.store.part)) return
          const batch = messageBatches(messages, input.store.part)[0]
          if (!batch || batch.length === 0) return
          const result = await retry(() =>
            input.client.session.messageChunk({ sessionID: input.sessionID, messageIDs: batch }),
          )
          batch.forEach((messageID) => input.setStore("part", messageID, []))
          for (const item of result.data ?? []) {
            input.setStore("part", item.messageID, sortParts(item.parts ?? []))
          }
          persistHistory(input.directory, input.sessionID, input.store)
          await nextFrame()
        }
      })
    }

    const loadMessages = async (input: {
      directory: string
      client: typeof sdk.client
      setStore: Setter
      store: Child[0]
      sessionID: string
      limit: number
    }) => {
      const key = keyFor(input.directory, input.sessionID)
      if (meta.loading[key]) return

      setMeta("loading", key, true)
      await fetchMessageIndex(input)
        .then((next) => {
          batch(() => {
            input.setStore("message", input.sessionID, reconcile(next.session, { key: "id" }))
            input.setStore("history", input.sessionID, {
              limit: input.limit,
              complete: next.complete,
            })
          })
          persistHistory(input.directory, input.sessionID, input.store)
        })
        .finally(() => {
          setMeta("loading", key, false)
        })

      void hydrateMessages(input)
    }

    return {
      get data() {
        return current()[0]
      },
      get set(): Setter {
        return current()[1]
      },
      get status() {
        return current()[0].status
      },
      get ready() {
        return current()[0].status !== "loading"
      },
      get project() {
        const store = current()[0]
        const match = Binary.search(globalSync.data.project, store.project, (p) => p.id)
        if (match.found) return globalSync.data.project[match.index]
        return undefined
      },
      session: {
        get: getSession,
        optimistic: {
          add(input: { directory?: string; sessionID: string; message: Message; parts: Part[] }) {
            const [store, setStore] = target(input.directory)
            setOptimisticAdd(setStore as (...args: unknown[]) => void, input)
            persistHistory(input.directory ?? sdk.directory, input.sessionID, store)
          },
          remove(input: { directory?: string; sessionID: string; messageID: string }) {
            const [store, setStore] = target(input.directory)
            setOptimisticRemove(setStore as (...args: unknown[]) => void, input)
            persistHistory(input.directory ?? sdk.directory, input.sessionID, store)
          },
        },
        addOptimisticMessage(input: {
          sessionID: string
          messageID: string
          parts: Part[]
          agent: string
          model: { providerID: string; modelID: string }
        }) {
          const message: Message = {
            id: input.messageID,
            sessionID: input.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: input.agent,
            model: input.model,
          }
          const [store, setStore] = target()
          setOptimisticAdd(setStore as (...args: unknown[]) => void, {
            sessionID: input.sessionID,
            message,
            parts: input.parts,
          })
          persistHistory(sdk.directory, input.sessionID, store)
        },
        async sync(sessionID: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          const key = keyFor(directory, sessionID)
          const hasSession = (() => {
            const match = Binary.search(store.session, sessionID, (s) => s.id)
            return match.found
          })()

          const hasMessages = store.message[sessionID] !== undefined
          const hydrated = store.history[sessionID] !== undefined
          const complete = messagePartsComplete(store.message[sessionID], store.part)
          if (hasSession && hasMessages && hydrated && complete) return

          const count = store.message[sessionID]?.length ?? 0
          const limit = store.history[sessionID]?.limit ?? limitFor(count)

          const sessionReq = hasSession
            ? Promise.resolve()
            : retry(() => client.session.get({ sessionID })).then((session) => {
                const data = session.data
                if (!data) return
                setStore(
                  "session",
                  produce((draft) => {
                    const match = Binary.search(draft, sessionID, (s) => s.id)
                    if (match.found) {
                      draft[match.index] = data
                      return
                    }
                    draft.splice(match.index, 0, data)
                  }),
                )
              })

          const messagesReq =
            hasMessages && hydrated
              ? Promise.resolve()
              : loadMessages({
                  directory,
                  client,
                  setStore,
                  store,
                  sessionID,
                  limit,
                })

          return runInflight(inflight, key, () => Promise.all([sessionReq, messagesReq]).then(() => {}))
        },
        diffComplete(sessionID: string) {
          const store = current()[0]
          return diffReady(store.session_diff[sessionID])
        },
        async diff(sessionID: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          const key = keyFor(directory, sessionID)

          if (store.session_diff[sessionID] === undefined) {
            await runInflight(inflightDiff, key, () =>
              retry(() => client.session.diffIndex({ sessionID })).then((diff) => {
                setStore("session_diff", sessionID, (current) => mergeDiffs(current, diff.data ?? []))
              }),
            )
          }

          if (diffReady(store.session_diff[sessionID])) return

          return runInflight(inflightDiffHydrate, key, async () => {
            await afterPaint()

            for (;;) {
              const next = store.session_diff[sessionID] ?? []
              if (diffReady(next)) return
              const batch = diffBatches(next)[0]
              if (!batch || batch.length === 0) return
              const diff = await retry(() => client.session.diffChunk({ sessionID, files: batch }))
              setStore("session_diff", sessionID, (current) => mergeDiffs(current, diff.data ?? []))
              await nextFrame()
            }
          })
        },
        async todo(sessionID: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          const existing = store.todo[sessionID]
          if (existing !== undefined) {
            if (globalSync.data.session_todo[sessionID] === undefined) {
              globalSync.todo.set(sessionID, existing)
            }
            return
          }

          const cached = globalSync.data.session_todo[sessionID]
          if (cached !== undefined) {
            setStore("todo", sessionID, reconcile(cached, { key: "id" }))
          }

          const key = keyFor(directory, sessionID)
          return runInflight(inflightTodo, key, () =>
            retry(() => client.session.todo({ sessionID })).then((todo) => {
              const list = todo.data ?? []
              setStore("todo", sessionID, reconcile(list, { key: "id" }))
              globalSync.todo.set(sessionID, list)
            }),
          )
        },
        history: {
          more(sessionID: string) {
            const store = current()[0]
            const history = store.history[sessionID]
            if (store.message[sessionID] === undefined) return false
            if (!history) return false
            if (history.complete) return false
            return true
          },
          loading(sessionID: string) {
            const key = keyFor(sdk.directory, sessionID)
            return meta.loading[key] ?? false
          },
          async loadMore(sessionID: string, count = messagePageSize) {
            const directory = sdk.directory
            const client = sdk.client
            const [store, setStore] = globalSync.child(directory)
            const key = keyFor(directory, sessionID)
            if (meta.loading[key]) return
            if (store.history[sessionID]?.complete) return

            const currentLimit = store.history[sessionID]?.limit ?? messagePageSize
            await loadMessages({
              directory,
              client,
              setStore,
              store,
              sessionID,
              limit: currentLimit + count,
            })
          },
        },
        fetch: async (count = 10) => {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          setStore("limit", (x) => x + count)
          await client.session.list().then((x) => {
            const sessions = (x.data ?? [])
              .filter((s) => !!s?.id)
              .sort((a, b) => cmp(a.id, b.id))
              .slice(0, store.limit)
            setStore("session", reconcile(sessions, { key: "id" }))
          })
        },
        more: createMemo(() => current()[0].session.length >= current()[0].limit),
        archive: async (sessionID: string) => {
          const directory = sdk.directory
          const client = sdk.client
          const [, setStore] = globalSync.child(directory)
          await client.session.update({ sessionID, time: { archived: Date.now() } })
          setStore(
            produce((draft) => {
              const match = Binary.search(draft.session, sessionID, (s) => s.id)
              if (match.found) draft.session.splice(match.index, 1)
            }),
          )
        },
      },
      absolute,
      get directory() {
        return current()[0].path.directory
      },
    }
  },
})
