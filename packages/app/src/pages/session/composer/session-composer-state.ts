import { createEffect, createMemo, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { PermissionRequest, QuestionRequest, Todo } from "@slopcode-ai/sdk/v2"
import { useParams } from "@solidjs/router"
import { showToast } from "@slopcode-ai/ui/toast"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { usePermission } from "@/context/permission"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { sessionPermissionRequests, sessionQuestionRequest } from "./session-request-tree"

export function createSessionComposerBlocked() {
  const params = useParams()
  const permission = usePermission()
  const sdk = useSDK()
  const sync = useSync()
  const permissionRequests = createMemo(() =>
    sessionPermissionRequests(sync.data.session, sync.data.permission, params.id, (item) => {
      return !permission.autoResponds(item, sdk.directory)
    }),
  )
  const questionRequest = createMemo(() => sessionQuestionRequest(sync.data.session, sync.data.question, params.id))

  return createMemo(() => {
    const id = params.id
    if (!id) return false
    return permissionRequests().length > 0 || !!questionRequest()
  })
}

export function createSessionComposerState() {
  const params = useParams()
  const sdk = useSDK()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const permission = usePermission()

  const questionRequest = createMemo((): QuestionRequest | undefined => {
    return sessionQuestionRequest(sync.data.session, sync.data.question, params.id)
  })

  const permissionRequests = createMemo((): PermissionRequest[] => {
    return sessionPermissionRequests(sync.data.session, sync.data.permission, params.id, (item) => {
      return !permission.autoResponds(item, sdk.directory)
    })
  })

  const blocked = createMemo(() => {
    const id = params.id
    if (!id) return false
    return permissionRequests().length > 0 || !!questionRequest()
  })

  const todos = createMemo((): Todo[] => {
    const id = params.id
    if (!id) return []
    return globalSync.data.session_todo[id] ?? []
  })

  const [store, setStore] = createStore({
    responding: undefined as string | undefined,
    dock: todos().length > 0,
    closing: false,
    opening: false,
  })

  const permissionResponding = createMemo(() => {
    return !!store.responding
  })

  const decide = (response: "once" | "always" | "reject", permissionIDs: string[]) => {
    const permissions = permissionRequests().filter((item) => permissionIDs.includes(item.id))
    if (permissions.length === 0) return
    const key = permissions.map((item) => item.id).join(":")
    if (store.responding === key) return

    setStore("responding", key)
    Promise.allSettled(
      permissions.map((item) => sdk.client.permission.respond({ sessionID: item.sessionID, permissionID: item.id, response })),
    )
      .then((result) => {
        const error = result.find((item) => item.status === "rejected")
        if (!error || error.status !== "rejected") return
        const description = error.reason instanceof Error ? error.reason.message : String(error.reason)
        showToast({ title: language.t("common.requestFailed"), description })
      })
      .finally(() => {
        setStore("responding", (id) => (id === key ? undefined : id))
      })
  }

  const done = createMemo(
    () => todos().length > 0 && todos().every((todo) => todo.status === "completed" || todo.status === "cancelled"),
  )

  let timer: number | undefined
  let raf: number | undefined

  const scheduleClose = () => {
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      setStore({ dock: false, closing: false })
      timer = undefined
    }, 400)
  }

  createEffect(
    on(
      () => [todos().length, done()] as const,
      ([count, complete], prev) => {
        if (raf) cancelAnimationFrame(raf)
        raf = undefined

        if (count === 0) {
          if (timer) window.clearTimeout(timer)
          timer = undefined
          setStore({ dock: false, closing: false, opening: false })
          return
        }

        if (!complete) {
          if (timer) window.clearTimeout(timer)
          timer = undefined
          const hidden = !store.dock || store.closing
          setStore({ dock: true, closing: false })
          if (hidden) {
            setStore("opening", true)
            raf = requestAnimationFrame(() => {
              setStore("opening", false)
              raf = undefined
            })
            return
          }
          setStore("opening", false)
          return
        }

        if (prev && prev[1]) {
          if (store.closing && !timer) scheduleClose()
          return
        }

        setStore({ dock: true, opening: false, closing: true })
        scheduleClose()
      },
    ),
  )

  onCleanup(() => {
    if (!timer) return
    window.clearTimeout(timer)
  })

  onCleanup(() => {
    if (!raf) return
    cancelAnimationFrame(raf)
  })

  return {
    blocked,
    questionRequest,
    permissionRequests,
    permissionResponding,
    decide,
    todos,
    dock: () => store.dock,
    closing: () => store.closing,
    opening: () => store.opening,
  }
}

export type SessionComposerState = ReturnType<typeof createSessionComposerState>
