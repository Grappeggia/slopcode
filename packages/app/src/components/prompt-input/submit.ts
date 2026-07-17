import type { Message, Session } from "@slopcode-ai/sdk/v2/client"
import { showToast } from "@/utils/toast"
import { base64Encode } from "@slopcode-ai/core/util/encode"
import { Binary } from "@slopcode-ai/core/util/binary"
import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { batch, createEffect, onCleanup, type Accessor } from "solid-js"
import type { FileSelection } from "@/context/file"
import { useServer } from "@/context/server"
import {
  draftSubmissionOwner,
  type DraftRequest,
  type DraftSnapshot,
  type DraftSubmission,
  useTabs,
} from "@/context/tabs"
import { useServerSync } from "@/context/server-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useLocal } from "@/context/local"
import { usePermission } from "@/context/permission"
import { DEFAULT_PROMPT, type ImageAttachmentPart, type Prompt, usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { Identifier } from "@/utils/id"
import { Worktree as WorktreeState } from "@/utils/worktree"
import { buildRequestParts, type PreparedPrompt } from "./build-request-parts"
import { setCursorPosition } from "./editor-dom"
import { formatServerError } from "@/utils/server-errors"
import { ScopedKey } from "@/utils/server-scope"
import { useComments } from "@/context/comments"
import { useServerSDK } from "@/context/server-sdk"

type PendingPrompt = {
  abort: AbortController
  cleanup: VoidFunction
}

const pending = new Map<string, PendingPrompt>()

function disposeSubmission(
  input: { serverSDK: ReturnType<typeof useServerSDK>; serverSync: ReturnType<typeof useServerSync> },
  state: DraftSubmission,
) {
  const worktree = WorktreeState.get(input.serverSDK.scope, state.directory)
  if (state.worktree === "create" || worktree?.status !== "failed")
    WorktreeState.clear(input.serverSDK.scope, state.directory)
  const messageID = state.delivery?.messageID ?? state.lastMessageID
  if (state.session && messageID && state.cleanedMessageID !== messageID) {
    input.serverSync.optimistic.remove(state.directory, state.session.id, messageID)
    state.cleanedMessageID = messageID
  }
  if (!state.session || state.cleanedSessionID === state.session.id) return
  state.cleanedSessionID = state.session.id
  const client = input.serverSDK.createClient({ directory: state.directory, throwOnError: true })
  void client.session.delete({ sessionID: state.session.id }).catch(() => {})
}

export type FollowupDraft = DraftRequest

type FollowupSendInput = {
  client: ReturnType<typeof useSDK>["client"]
  serverSync: ReturnType<typeof useServerSync>
  sync: ReturnType<typeof useSync>
  draft: FollowupDraft
  messageID?: string
  optimisticBusy?: boolean
  before?: () => Promise<boolean> | boolean
  prepared?: PreparedPrompt
}

export type PromptDelivery = "rejected" | "ambiguous" | "not-sent"

const ambiguous = new Set([408, 425, 429, 499])

function detailMessage(detail: unknown): string | undefined {
  if (detail instanceof Error) return detail.message
  if (typeof detail === "string") return detail
  if (!detail || typeof detail !== "object") return undefined
  if ("message" in detail && typeof detail.message === "string") return detail.message
  if (!("data" in detail)) return undefined
  const data = detail.data
  if (!data || typeof data !== "object" || !("message" in data) || typeof data.message !== "string") return undefined
  return data.message
}

export class PromptDeliveryError extends Error {
  readonly delivery: PromptDelivery
  readonly status?: number
  readonly detail: unknown

  constructor(detail: unknown, response?: Response, delivery?: PromptDelivery) {
    super(detailMessage(detail) ?? "Prompt delivery failed")
    this.name = "PromptDeliveryError"
    this.delivery =
      delivery ??
      (response && response.status >= 400 && response.status < 500 && !ambiguous.has(response.status)
        ? "rejected"
        : "ambiguous")
    this.status = response?.status
    this.detail = detail
  }
}

const draftText = (prompt: Prompt) => prompt.map((part) => ("content" in part ? part.content : "")).join("")

const draftImages = (prompt: Prompt) => prompt.filter((part): part is ImageAttachmentPart => part.type === "image")

export async function sendFollowupDraft(input: FollowupSendInput) {
  const text = draftText(input.draft.prompt)
  const images = draftImages(input.draft.prompt)
  const [, setStore] = input.serverSync.child(input.draft.sessionDirectory)

  const setBusy = () => {
    if (!input.optimisticBusy) return
    setStore("session_status", input.draft.sessionID, { type: "busy" })
  }

  const setIdle = () => {
    if (!input.optimisticBusy) return
    setStore("session_status", input.draft.sessionID, { type: "idle" })
  }

  const wait = async () => {
    const ok = await input.before?.()
    if (ok === false) return false
    return true
  }

  const [head, ...tail] = text.split(" ")
  const cmd = head?.startsWith("/") ? head.slice(1) : undefined
  if (!input.prepared && cmd && input.sync.data.command.find((item) => item.name === cmd)) {
    setBusy()
    try {
      if (!(await wait())) {
        setIdle()
        return false
      }

      await input.client.session.command({
        sessionID: input.draft.sessionID,
        command: cmd,
        arguments: tail.join(" "),
        agent: input.draft.agent,
        model: `${input.draft.model.providerID}/${input.draft.model.modelID}`,
        variant: input.draft.variant,
        parts: images.map((attachment) => ({
          id: Identifier.ascending("part"),
          type: "file" as const,
          mime: attachment.mime,
          url: attachment.dataUrl,
          filename: attachment.filename,
        })),
      })
      return true
    } catch (err) {
      setIdle()
      throw err
    }
  }

  const messageID = input.messageID ?? Identifier.ascending("message")
  const { requestParts, optimisticParts } =
    input.prepared ??
    buildRequestParts({
      prompt: input.draft.prompt,
      context: input.draft.context,
      images,
      text,
      sessionID: input.draft.sessionID,
      messageID,
      sessionDirectory: input.draft.sessionDirectory,
    })

  const message: Message = {
    id: messageID,
    sessionID: input.draft.sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: input.draft.agent,
    model: { ...input.draft.model, variant: input.draft.variant },
  }

  const add = () =>
    input.sync.session.optimistic.add({
      directory: input.draft.sessionDirectory,
      sessionID: input.draft.sessionID,
      message,
      parts: optimisticParts,
    })

  const remove = () =>
    input.sync.session.optimistic.remove({
      directory: input.draft.sessionDirectory,
      sessionID: input.draft.sessionID,
      messageID,
    })

  batch(() => {
    setBusy()
    remove()
    add()
  })

  try {
    if (!(await wait())) {
      batch(() => {
        setIdle()
        remove()
      })
      return false
    }
  } catch (err) {
    batch(() => {
      setIdle()
      remove()
    })
    throw new PromptDeliveryError(err, undefined, "not-sent")
  }

  try {
    const result = await input.client.session.promptAsync(
      {
        sessionID: input.draft.sessionID,
        agent: input.draft.agent,
        model: input.draft.model,
        messageID,
        parts: requestParts,
        variant: input.draft.variant,
      },
      { throwOnError: false },
    )
    if (result.error) throw new PromptDeliveryError(result.error, result.response)
    return true
  } catch (err) {
    batch(() => {
      setIdle()
      remove()
    })
    if (err instanceof PromptDeliveryError) throw err
    throw new PromptDeliveryError(err)
  }
}

type PromptSubmitInput = {
  info: Accessor<{ id: string } | undefined>
  imageAttachments: Accessor<ImageAttachmentPart[]>
  commentCount: Accessor<number>
  autoAccept: Accessor<boolean>
  mode: Accessor<"normal" | "shell">
  working: Accessor<boolean>
  editor: () => HTMLDivElement | undefined
  queueScroll: () => void
  promptLength: (prompt: Prompt) => number
  addToHistory: (prompt: Prompt, mode: "normal" | "shell") => void
  resetHistoryNavigation: () => void
  setMode: (mode: "normal" | "shell") => void
  setPopover: (popover: "at" | "slash" | null) => void
  newSessionWorktree?: Accessor<string | undefined>
  onNewSessionWorktreeReset?: () => void
  shouldQueue?: Accessor<boolean>
  onQueue?: (draft: FollowupDraft) => void
  onAbort?: () => void
  onSubmit?: () => void
  draftReady?: Accessor<boolean>
}

type CommentItem = {
  path: string
  selection?: FileSelection
  comment?: string
  commentID?: string
  commentOrigin?: "review" | "file"
  preview?: string
}

export function createPromptSubmit(input: PromptSubmitInput) {
  const navigate = useNavigate()
  const sdk = useSDK()
  const serverSDK = useServerSDK()
  const sync = useSync()
  const serverSync = useServerSync()
  const local = useLocal()
  const permission = usePermission()
  const prompt = usePrompt()
  const comments = useComments()
  const layout = useLayout()
  const language = useLanguage()
  const params = useParams()
  const [search] = useSearchParams<{ draftId?: string }>()
  const server = useServer()
  const tabs = useTabs()
  const pendingKey = (sessionID: string) => ScopedKey.from(sdk.scope, sessionID)
  const draftID = search.draftId
  const owner = draftSubmissionOwner(server.key, draftID, sdk.directory)
  let submission: Promise<void> | undefined
  let active = true
  const draftAlive = () =>
    !draftID || tabs.store.some((tab) => tab.type === "draft" && tab.draftID === draftID && tab.server === server.key)
  const activeOwner = () => active && !params.id && (draftID ? search.draftId === draftID : !search.draftId)
  const held = (state: NonNullable<ReturnType<typeof tabs.submission.get>>) =>
    draftAlive() && tabs.submission.get(owner) === state
  const owns = (state: NonNullable<ReturnType<typeof tabs.submission.get>>) => activeOwner() && held(state)
  const cleanup = (state: NonNullable<ReturnType<typeof tabs.submission.get>>) =>
    disposeSubmission({ serverSDK, serverSync }, state)
  const discard = (state: NonNullable<ReturnType<typeof tabs.submission.get>>) => {
    if (tabs.submission.get(owner) !== state) return
    tabs.submission.clear(owner)
  }
  onCleanup(() => {
    active = false
    if (draftID) return
    const state = tabs.submission.get(owner)
    if (!state) return
    state.abandoned = true
    if (state.creating || state.delivery?.sending) {
      tabs.submission.touch()
      return
    }
    discard(state)
  })

  const errorMessage = (err: unknown) => {
    return detailMessage(err) ?? language.t("common.requestFailed")
  }

  const abort = async () => {
    const sessionID = params.id
    if (!sessionID) return Promise.resolve()

    serverSync.todo.set(sessionID, [])
    const [, setStore] = serverSync.child(sdk.directory)
    setStore("todo", sessionID, [])

    input.onAbort?.()

    const key = pendingKey(sessionID)
    const queued = pending.get(key)
    if (queued) {
      queued.abort.abort()
      queued.cleanup()
      pending.delete(key)
      return Promise.resolve()
    }
    return sdk.client.session
      .abort({
        sessionID,
      })
      .catch(() => {})
  }

  const restoreCommentItems = (items: CommentItem[]) => {
    for (const item of items) {
      prompt.context.add({
        type: "file",
        path: item.path,
        selection: item.selection,
        comment: item.comment,
        commentID: item.commentID,
        commentOrigin: item.commentOrigin,
        preview: item.preview,
      })
    }
  }

  const removeCommentItems = (items: { key: string }[]) => {
    for (const item of items) {
      prompt.context.remove(item.key)
    }
  }

  const clearContext = () => {
    for (const item of prompt.context.items()) {
      prompt.context.remove(item.key)
    }
  }

  const seed = (dir: string, info: Session) => {
    const [, setStore] = serverSync.child(dir)
    setStore("session", (list: Session[]) => {
      const result = Binary.search(list, info.id, (item) => item.id)
      const next = [...list]
      if (result.found) {
        next[result.index] = info
        return next
      }
      next.splice(result.index, 0, info)
      return next
    })
  }

  const currentSnapshot = (worktree: string): DraftSnapshot => {
    const value = prompt.snapshot()
    return {
      prompt: value.prompt,
      cursor: value.cursor,
      context: value.context,
      mode: input.mode(),
      worktree,
    }
  }

  const sameSnapshot = (a: DraftSnapshot, b: DraftSnapshot) =>
    JSON.stringify({ prompt: a.prompt, context: a.context, mode: a.mode, worktree: a.worktree }) ===
    JSON.stringify({ prompt: b.prompt, context: b.context, mode: b.mode, worktree: b.worktree })

  const clearDraft = () => {
    prompt.replace({ prompt: DEFAULT_PROMPT, cursor: 0, context: [], mode: "normal" })
    input.setMode("normal")
    input.setPopover(null)
    input.onSubmit?.()
  }

  const finalize = (state: NonNullable<ReturnType<typeof tabs.submission.get>>) => {
    if (
      !owns(state) ||
      (input.draftReady && !input.draftReady()) ||
      state.finalizing ||
      !state.accepted ||
      !state.session ||
      !state.delivery
    )
      return
    state.finalizing = true
    const current = currentSnapshot(input.newSessionWorktree?.() || "main")
    const unchanged = sameSnapshot(current, state.delivery.snapshot)
    const scope = { dir: base64Encode(state.directory), id: state.session.id }

    if (unchanged) clearDraft()
    if (!unchanged) {
      prompt.replace(
        {
          prompt: current.prompt,
          cursor: current.cursor,
          context: current.context,
          mode: current.mode,
        },
        scope,
      )
      comments.replace(comments.all(), scope)
      if (!draftID) {
        prompt.replace({ prompt: DEFAULT_PROMPT, cursor: 0, context: [], mode: "normal" })
        comments.clear()
      }
    }

    input.addToHistory(state.delivery.request.prompt, state.delivery.snapshot.mode)
    input.resetHistoryNavigation()
    seed(state.directory, state.session)
    local.session.promote(state.directory, state.session.id)
    layout.handoff.setTabs(base64Encode(state.directory), state.session.id)
    input.onNewSessionWorktreeReset?.()
    if (draftID) {
      tabs.promoteDraft(draftID, {
        server: server.key,
        dirBase64: base64Encode(state.directory),
        sessionId: state.session.id,
      })
      return
    }
    tabs.submission.release(owner)
    navigate(`/${base64Encode(state.directory)}/session/${state.session.id}`)
  }

  createEffect(() => {
    const state = tabs.submission.get(owner)
    if (state?.accepted) finalize(state)
  })

  const submit = async () => {
    const worktreeSelection = input.newSessionWorktree?.() || "main"
    const snapshot = currentSnapshot(worktreeSelection)
    const currentPrompt = snapshot.prompt
    const text = currentPrompt.map((part) => ("content" in part ? part.content : "")).join("")
    const images = input.imageAttachments().map((image) => ({ ...image }))
    const mode = snapshot.mode
    const context = snapshot.context
    const selectedModel = local.model.current()
    const selectedAgent = local.agent.current()
    const variant = local.model.variant.current()

    const projectDirectory = sdk.directory
    const isNewSession = !params.id
    let retained = isNewSession ? tabs.submission.get(owner) : undefined
    if (retained?.abandoned || (retained && WorktreeState.get(sdk.scope, retained.directory)?.status === "failed")) {
      discard(retained)
      retained = undefined
    }
    if (retained && !retained.delivery && retained.worktree !== worktreeSelection) {
      discard(retained)
      retained = undefined
    }
    if (retained?.accepted) {
      finalize(retained)
      return
    }

    if (text.trim().length === 0 && images.length === 0 && input.commentCount() === 0) {
      if (input.working()) void abort()
      return
    }

    const currentModel = selectedModel ?? local.model.current()
    const currentAgent = selectedAgent ?? local.agent.current()
    if (!currentModel || !currentAgent) {
      showToast({
        title: language.t("prompt.toast.modelAgentRequired.title"),
        description: language.t("prompt.toast.modelAgentRequired.description"),
      })
      return
    }

    if (!isNewSession) {
      input.addToHistory(currentPrompt, mode)
      input.resetHistoryNavigation()
    }

    const shouldAutoAccept = isNewSession && input.autoAccept()
    let state = retained
    let scopedClient: typeof sdk.client | undefined
    if (isNewSession && state?.creating) return
    if (isNewSession && !state) {
      state = tabs.submission.set(owner, {
        directory:
          worktreeSelection !== "main" && worktreeSelection !== "create" ? worktreeSelection : projectDirectory,
        worktree: worktreeSelection,
        creating: true,
        autoAccept: shouldAutoAccept,
      })
      const createdState = state
      state.dispose = () => disposeSubmission({ serverSDK, serverSync }, createdState)

      if (worktreeSelection === "create") {
        const failure: { value?: unknown } = {}
        const created = await sdk.client.worktree
          .create({ directory: projectDirectory })
          .then((result) => result.data)
          .catch((err) => {
            failure.value = err
            return undefined
          })
        if (!held(state)) {
          cleanup(state)
          return
        }
        if (!created?.directory) {
          const visible = owns(state)
          discard(state)
          if (!visible) return
          showToast({
            title: language.t("prompt.toast.worktreeCreateFailed.title"),
            description: failure.value ? errorMessage(failure.value) : language.t("common.requestFailed"),
          })
          return
        }
        state.directory = created.directory
        WorktreeState.pending(sdk.scope, state.directory)
        if (state.abandoned) {
          state.creating = false
          discard(state)
          return
        }
        if (!owns(state)) {
          state.creating = false
          return
        }
      }

      const scoped =
        state.directory === projectDirectory
          ? sdk.client
          : sdk.createClient({ directory: state.directory, throwOnError: true })
      scopedClient = scoped
      const failure: { value?: unknown } = {}
      const created = await scoped.session
        .create()
        .then((result) => result.data)
        .catch((err) => {
          failure.value = err
          return undefined
        })
      state.creating = false
      if (created) state.session = created
      if (!held(state)) {
        cleanup(state)
        return
      }
      if (!created) {
        const visible = owns(state)
        discard(state)
        if (!visible) return
        showToast({
          title: language.t("prompt.toast.sessionCreateFailed.title"),
          description: failure.value ? errorMessage(failure.value) : language.t("common.requestFailed"),
        })
        return
      }
      if (state.abandoned) {
        discard(state)
        return
      }
      if (!owns(state)) return
    }

    if (isNewSession && state && !state.session && !state.creating) {
      state.creating = true
      const scoped =
        state.directory === projectDirectory
          ? sdk.client
          : sdk.createClient({ directory: state.directory, throwOnError: true })
      scopedClient = scoped
      const failure: { value?: unknown } = {}
      const created = await scoped.session
        .create()
        .then((result) => result.data)
        .catch((err) => {
          failure.value = err
          return undefined
        })
      state.creating = false
      if (created) state.session = created
      if (!held(state)) {
        cleanup(state)
        return
      }
      if (!created) {
        const visible = owns(state)
        discard(state)
        if (!visible) return
        showToast({
          title: language.t("prompt.toast.sessionCreateFailed.title"),
          description: failure.value ? errorMessage(failure.value) : language.t("common.requestFailed"),
        })
        return
      }
      if (state.abandoned) {
        discard(state)
        return
      }
      if (!owns(state)) return
    }

    const sessionDirectory = state?.directory ?? projectDirectory
    const client =
      scopedClient ??
      (sessionDirectory === projectDirectory
        ? sdk.client
        : sdk.createClient({ directory: sessionDirectory, throwOnError: true }))
    if (sessionDirectory !== projectDirectory) serverSync.child(sessionDirectory)
    const session = state?.session ?? input.info()
    if (state?.session && state.autoAccept && !state.autoAccepted) {
      permission.enableAutoAccept(state.session.id, state.directory)
      state.autoAccepted = true
    }
    if (!session) {
      showToast({
        title: language.t("prompt.toast.promptSendFailed.title"),
        description: language.t("prompt.toast.promptSendFailed.description"),
      })
      return
    }

    const model = {
      modelID: currentModel.id,
      providerID: currentModel.provider.id,
    }
    const agent = currentAgent.name
    const draft: FollowupDraft = {
      sessionID: session.id,
      sessionDirectory,
      prompt: currentPrompt,
      context,
      agent,
      model,
      variant,
    }

    const clearInput = () => {
      prompt.reset()
      input.setMode("normal")
      input.setPopover(null)
    }

    const restoreInput = () => {
      prompt.set(currentPrompt, input.promptLength(currentPrompt))
      input.setMode(mode)
      input.setPopover(null)
      requestAnimationFrame(() => {
        const editor = input.editor()
        if (!editor) return
        editor.focus()
        setCursorPosition(editor, input.promptLength(currentPrompt))
        input.queueScroll()
      })
    }

    const promoteImmediate = () => {
      if (!isNewSession || !state?.session || !owns(state)) return
      seed(sessionDirectory, state.session)
      local.session.promote(sessionDirectory, session.id)
      layout.handoff.setTabs(base64Encode(sessionDirectory), session.id)
      if (draftID)
        tabs.promoteDraft(draftID, {
          server: server.key,
          dirBase64: base64Encode(sessionDirectory),
          sessionId: session.id,
        })
      else {
        tabs.submission.release(owner)
        navigate(`/${base64Encode(sessionDirectory)}/session/${session.id}`)
      }
      input.onNewSessionWorktreeReset?.()
    }

    if (!isNewSession && mode === "normal" && input.shouldQueue?.()) {
      input.onQueue?.(draft)
      clearContext()
      clearInput()
      return
    }

    if (!isNewSession) input.onSubmit?.()

    if (mode === "shell" && !state?.delivery) {
      if (isNewSession) {
        input.addToHistory(currentPrompt, mode)
        input.resetHistoryNavigation()
        promoteImmediate()
        input.onSubmit?.()
      }
      clearInput()
      client.session
        .shell({
          sessionID: session.id,
          agent,
          model,
          command: text,
        })
        .catch((err) => {
          showToast({
            title: language.t("prompt.toast.shellSendFailed.title"),
            description: errorMessage(err),
          })
          restoreInput()
        })
      return
    }

    if (text.startsWith("/") && !state?.delivery) {
      const [cmdName, ...args] = text.split(" ")
      const commandName = cmdName.slice(1)
      const customCommand = sync.data.command.find((c) => c.name === commandName)
      if (customCommand) {
        if (isNewSession) {
          input.addToHistory(currentPrompt, mode)
          input.resetHistoryNavigation()
          promoteImmediate()
          input.onSubmit?.()
        }
        clearInput()
        client.session
          .command({
            sessionID: session.id,
            command: commandName,
            arguments: args.join(" "),
            agent,
            model: `${model.providerID}/${model.modelID}`,
            variant,
            parts: images.map((attachment) => ({
              id: Identifier.ascending("part"),
              type: "file" as const,
              mime: attachment.mime,
              url: attachment.dataUrl,
              filename: attachment.filename,
            })),
          })
          .catch((err) => {
            showToast({
              title: language.t("prompt.toast.commandSendFailed.title"),
              description: formatServerError(err, language.t, language.t("common.requestFailed")),
            })
            restoreInput()
          })
        return
      }
    }

    const delivery =
      state?.delivery ??
      (() => {
        const messageID = Identifier.ascending("message")
        return {
          messageID,
          request: draft,
          snapshot,
          prepared: buildRequestParts({
            prompt: draft.prompt,
            context: draft.context,
            images: draftImages(draft.prompt),
            text: draftText(draft.prompt),
            sessionID: draft.sessionID,
            messageID,
            sessionDirectory: draft.sessionDirectory,
          }),
          sending: false,
        }
      })()
    if (state) state.delivery = delivery
    if (state) state.lastMessageID = delivery.messageID
    const commentItems = delivery.request.context.filter((item) => item.type === "file" && !!item.comment?.trim())
    const messageID = delivery.messageID

    const removeOptimisticMessage = () => {
      sync.session.optimistic.remove({
        directory: sessionDirectory,
        sessionID: session.id,
        messageID,
      })
    }

    if (!isNewSession) {
      removeCommentItems(commentItems)
      clearInput()
    }

    const waitForWorktree = async () => {
      const worktree = WorktreeState.get(sdk.scope, sessionDirectory)
      if (!worktree || worktree.status === "ready") return true
      if (worktree.status === "failed") throw new Error(worktree.message)

      if (sessionDirectory === projectDirectory) {
        sync.set("session_status", session.id, { type: "busy" })
      }

      const controller = new AbortController()
      const cleanup = () => {
        if (sessionDirectory === projectDirectory) {
          sync.set("session_status", session.id, { type: "idle" })
        }
        removeOptimisticMessage()
        if (!isNewSession) {
          restoreCommentItems(commentItems)
          restoreInput()
        }
      }

      pending.set(pendingKey(session.id), { abort: controller, cleanup })

      const abortWait = new Promise<Awaited<ReturnType<typeof WorktreeState.wait>>>((resolve) => {
        if (controller.signal.aborted) {
          resolve({ status: "failed", message: "aborted" })
          return
        }
        controller.signal.addEventListener(
          "abort",
          () => {
            resolve({ status: "failed", message: "aborted" })
          },
          { once: true },
        )
      })

      const timeoutMs = 5 * 60 * 1000
      const timer = { id: undefined as number | undefined }
      const timeout = new Promise<Awaited<ReturnType<typeof WorktreeState.wait>>>((resolve) => {
        timer.id = window.setTimeout(() => {
          resolve({
            status: "failed",
            message: language.t("workspace.error.stillPreparing"),
          })
        }, timeoutMs)
      })

      const result = await Promise.race([WorktreeState.wait(sdk.scope, sessionDirectory), abortWait, timeout]).finally(
        () => {
          if (timer.id === undefined) return
          clearTimeout(timer.id)
        },
      )
      pending.delete(pendingKey(session.id))
      if (isNewSession && state && !owns(state)) return false
      if (controller.signal.aborted) return false
      if (result.status === "failed") throw new Error(result.message)
      return true
    }

    if (isNewSession && delivery.sending) return
    if (isNewSession) delivery.sending = true
    const send = sendFollowupDraft({
      client,
      sync,
      serverSync,
      draft: delivery.request,
      messageID,
      optimisticBusy: sessionDirectory === projectDirectory,
      before: waitForWorktree,
      prepared: delivery.prepared,
    })

    if (isNewSession) {
      try {
        const accepted = await send
        if (!state) return
        if (!held(state)) {
          cleanup(state)
          return
        }
        delivery.sending = false
        if (state.abandoned) {
          discard(state)
          return
        }
        if (!accepted) {
          state.delivery = undefined
          const failed = WorktreeState.get(sdk.scope, state.directory)?.status === "failed"
          const changed = (input.newSessionWorktree?.() || "main") !== state.worktree
          if (failed || changed) discard(state)
          return
        }
        state.accepted = true
        tabs.submission.touch()
        if (!owns(state)) return
        finalize(state)
      } catch (err) {
        if (!state) return
        if (!held(state)) {
          cleanup(state)
          return
        }
        delivery.sending = false
        pending.delete(pendingKey(session.id))
        if (sessionDirectory === projectDirectory) sync.set("session_status", session.id, { type: "idle" })
        if (state.abandoned) {
          discard(state)
          return
        }
        if (err instanceof PromptDeliveryError && err.delivery !== "ambiguous") {
          state.delivery = undefined
          const failed = WorktreeState.get(sdk.scope, state.directory)?.status === "failed"
          const changed = (input.newSessionWorktree?.() || "main") !== state.worktree
          if (failed || changed) {
            discard(state)
            return
          }
        }
        if (!owns(state)) return
        showToast({
          title: language.t("prompt.toast.promptSendFailed.title"),
          description: errorMessage(err),
        })
      }
      return
    }

    void send.catch((err) => {
      pending.delete(pendingKey(session.id))
      if (sessionDirectory === projectDirectory) {
        sync.set("session_status", session.id, { type: "idle" })
      }
      showToast({
        title: language.t("prompt.toast.promptSendFailed.title"),
        description: errorMessage(err),
      })
      removeOptimisticMessage()
      restoreCommentItems(commentItems)
      restoreInput()
    })
  }

  const handleSubmit = (event: Event) => {
    event.preventDefault()
    if (params.id) return submit()
    if (submission) return submission
    const next = submit().finally(() => {
      if (submission === next) submission = undefined
    })
    submission = next
    return next
  }

  return {
    abort,
    handleSubmit,
  }
}
