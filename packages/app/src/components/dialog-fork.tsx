import { Component, Show, createMemo } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { usePrompt } from "@/context/prompt"
import { useLayout } from "@/context/layout"
import { applyDirectoryEvent } from "@/context/global-sync/event-reducer"
import { useDialog } from "@slopcode-ai/ui/context/dialog"
import { Dialog } from "@slopcode-ai/ui/dialog"
import { List } from "@slopcode-ai/ui/list"
import { showToast } from "@slopcode-ai/ui/toast"
import { extractPromptFromParts } from "@/utils/prompt"
import type { Session, TextPart as SDKTextPart } from "@slopcode-ai/sdk/v2/client"
import { base64Encode } from "@slopcode-ai/util/encode"
import { useLanguage } from "@/context/language"
import { forkTabs } from "./dialog-fork-state"

interface ForkableMessage {
  id?: string
  text: string
  time?: string
  full?: boolean
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { timeStyle: "short" })
}

function insertForkedSession(input: {
  session: Session
  store: ReturnType<typeof useSync>["data"]
  setStore: ReturnType<typeof useSync>["set"]
  directory: string
}) {
  applyDirectoryEvent({
    event: { type: "session.created", properties: { info: input.session } },
    store: input.store,
    setStore: input.setStore,
    directory: input.directory,
    push() {},
    loadLsp() {},
  })
}

export const DialogFork: Component = () => {
  const params = useParams()
  const navigate = useNavigate()
  const sync = useSync()
  const sdk = useSDK()
  const prompt = usePrompt()
  const layout = useLayout()
  const dialog = useDialog()
  const language = useLanguage()

  const messages = createMemo((): ForkableMessage[] => {
    const sessionID = params.id
    if (!sessionID) return []

    const msgs = sync.data.message[sessionID] ?? []
    const result: ForkableMessage[] = [
      {
        text: language.t("dialog.fork.fullSession"),
        full: true,
      },
    ]

    for (const message of msgs) {
      if (message.role !== "user") continue

      const parts = sync.data.part[message.id] ?? []
      const textPart = parts.find((x): x is SDKTextPart => x.type === "text" && !x.synthetic && !x.ignored)
      if (!textPart) continue

      result.push({
        id: message.id,
        text: textPart.text.replace(/\n/g, " ").slice(0, 200),
        time: formatTime(new Date(message.time.created)),
      })
    }

    return [result[0]!, ...result.slice(1).reverse()]
  })

  const handleSelect = (item: ForkableMessage | undefined) => {
    if (!item) return

    const sessionID = params.id
    if (!sessionID) return

    const restored = item.id
      ? extractPromptFromParts(sync.data.part[item.id] ?? [], {
          directory: sdk.directory,
          attachmentName: language.t("common.attachment"),
        })
      : undefined

    sdk.client.session
      .fork(item.id ? { sessionID, messageID: item.id } : { sessionID })
      .then((forked) => {
        if (!forked.data) {
          showToast({ title: language.t("common.requestFailed") })
          return
        }

        insertForkedSession({
          session: forked.data,
          store: sync.data,
          setStore: sync.set,
          directory: sdk.directory,
        })

        const current = layout.tabs(`${params.dir ?? ""}/${sessionID}`).tabs()
        const next = forkTabs(current)
        if (next.all.length > 0) {
          const tabs = layout.tabs(`${params.dir ?? ""}/${forked.data.id}`)
          tabs.setAll(next.all)
          tabs.setActive(next.active)
        }

        dialog.close()
        navigate(`/${base64Encode(sdk.directory)}/session/${forked.data.id}`)
        if (!restored) return
        requestAnimationFrame(() => {
          prompt.set(restored)
        })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        showToast({ title: language.t("common.requestFailed"), description: message })
      })
  }

  return (
    <Dialog title={language.t("command.session.fork")}>
      <List
        class="flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
        search={{ placeholder: language.t("common.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("dialog.fork.empty")}
        key={(x) => x.id ?? "__full-session__"}
        items={messages}
        filterKeys={["text"]}
        onSelect={handleSelect}
      >
        {(item) => (
          <div class="w-full flex items-center gap-2">
            <span class="truncate flex-1 min-w-0 text-left font-normal">{item.text}</span>
            <Show when={item.time}>
              <span class="text-text-weak shrink-0 font-normal">{item.time}</span>
            </Show>
          </div>
        )}
      </List>
    </Dialog>
  )
}
