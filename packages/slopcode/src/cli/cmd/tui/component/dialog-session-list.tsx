import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { createMemo, createResource, createSignal, onMount } from "solid-js"
import { Locale } from "@/util/locale"
import { useKeybind } from "../context/keybind"
import { useTheme } from "../context/theme"
import { useSDK } from "../context/sdk"
import { DialogSessionRename } from "./dialog-session-rename"
import { createDebouncedSignal } from "../util/signal"
import { sessionWaiting } from "../context/session-tabs-state"
import { Spinner } from "./spinner"

export function DialogSessionList(props: { workspaceID?: string | null }) {
  const dialog = useDialog()
  const route = useRoute()
  const sync = useSync()
  const keybind = useKeybind()
  const { theme } = useTheme()
  const sdk = useSDK()

  const [toDelete, setToDelete] = createSignal<string>()
  const [search, setSearch] = createDebouncedSignal("", 150)

  const workspaceID = createMemo(() =>
    props.workspaceID === undefined ? route.data.workspaceID : props.workspaceID || undefined,
  )
  const client = createMemo(() => sdk.clientFor(workspaceID()))

  const filterExplicit = (items: Awaited<ReturnType<ReturnType<typeof client>["session"]["list"]>>["data"] | undefined) => {
    const list = items ?? []
    if (props.workspaceID === null) return list.filter((item) => !(item as { workspaceID?: string }).workspaceID)
    if (typeof props.workspaceID === "string")
      return list.filter((item) => (item as { workspaceID?: string }).workspaceID === props.workspaceID)
    return list
  }

  const [listed, listedCtrl] = createResource(
    () => (props.workspaceID === undefined ? undefined : props.workspaceID || "__local__"),
    async () => {
      const result = await client().session.list({ limit: 100 })
      return filterExplicit(result.data)
    },
  )

  const [searchResults] = createResource(
    () => [search(), workspaceID() ?? "__local__", props.workspaceID === undefined ? "route" : "explicit"] as const,
    async ([query]) => {
      if (!query) return undefined
      const result = await client().session.list({
        search: query,
        limit: 30,
        ...(props.workspaceID === undefined ? sync.session.query() : {}),
      })
      return filterExplicit(result.data)
    },
  )

  const currentSessionID = createMemo(() => {
    if (route.data.type !== "session") return undefined
    if (route.data.workspaceID !== workspaceID()) return undefined
    return route.data.sessionID
  })

  const sessions = createMemo(() => {
    const searched = searchResults()
    if (searched) return searched
    if (props.workspaceID !== undefined) return listed() ?? []
    return sync.data.session
  })

  const options = createMemo(() => {
    const today = new Date().toDateString()
    return sessions()
      .filter((x) => x.parentID === undefined)
      .toSorted((a, b) => b.time.updated - a.time.updated)
      .map((x) => {
        const date = new Date(x.time.updated)
        const category = date.toDateString() === today ? "Today" : date.toDateString()
        const isDeleting = toDelete() === x.id
        const status = sync.data.session_status?.[x.id]
        const isWaiting = sessionWaiting({
          sessionID: x.id,
          sessions: sync.data.session,
          permission: sync.data.permission,
          question: sync.data.question,
        })
        const isWorking = !isWaiting && (status?.type === "busy" || status?.type === "retry")
        return {
          title: isDeleting ? `Press ${keybind.print("session_delete")} again to confirm` : x.title,
          bg: isDeleting ? theme.error : undefined,
          value: x.id,
          category,
          footer: Locale.time(x.time.updated),
          gutter: isWorking ? <Spinner /> : isWaiting ? <text fg={theme.textMuted}>■</text> : undefined,
        }
      })
  })

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <DialogSelect
      title="Sessions"
      options={options()}
      skipFilter={true}
      current={currentSessionID()}
      onFilter={setSearch}
      onMove={() => {
        setToDelete(undefined)
      }}
      onSelect={async (option) => {
        const selected = sessions().find((item) => item.id === option.value)
        const targetWorkspaceID = (selected as { workspaceID?: string } | undefined)?.workspaceID ?? workspaceID()
        route.navigate({
          type: "session",
          sessionID: option.value,
          source: "switch",
          workspaceID: targetWorkspaceID,
        })
        if (targetWorkspaceID !== sdk.workspaceID) {
          await sync.bootstrap()
        }
        dialog.clear()
      }}
      keybind={[
        {
          keybind: keybind.all.session_delete?.[0],
          title: "delete",
          onTrigger: async (option) => {
            if (toDelete() === option.value) {
              await client().session.delete({ sessionID: option.value })
              if (props.workspaceID !== undefined) {
                await listedCtrl.refetch()
              }
              setToDelete(undefined)
              return
            }
            setToDelete(option.value)
          },
        },
        {
          keybind: keybind.all.session_rename?.[0],
          title: "rename",
          onTrigger: async (option) => {
            dialog.replace(() => <DialogSessionRename session={option.value} workspaceID={workspaceID()} />)
          },
        },
      ]}
    />
  )
}
