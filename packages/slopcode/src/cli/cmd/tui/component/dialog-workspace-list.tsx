import { createEffect, createMemo, createResource, createSignal, onMount } from "solid-js"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useRoute } from "@tui/context/route"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useToast } from "@tui/ui/toast"
import { useKeybind } from "@tui/context/keybind"
import { Identifier } from "@/id/id"
import { DialogSessionList } from "./dialog-session-list"

type CountState = Record<string, number | null | undefined>
type WorkspaceAdaptor = { type: string; name: string; description: string }

function DialogWorkspaceCreate(props: { onDone: (workspaceID: string) => Promise<void> }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const [creating, setCreating] = createSignal(false)
  const [adaptors] = createResource(async () => {
    const workspace = sdk.client.experimental.workspace as unknown as {
      adaptors(): Promise<{ data?: WorkspaceAdaptor[] }>
    }
    const result = await workspace.adaptors()
    return result.data ?? [{ type: "worktree", name: "Worktree", description: "Create a local git worktree" }]
  })

  onMount(() => {
    dialog.setSize("medium")
  })

  const createWorkspace = async (type: string) => {
    if (creating()) return
    setCreating(true)
    const id = Identifier.ascending("workspace")
    const directory = sync.data.path.worktree || sync.data.path.directory || sdk.directory || process.cwd()
    const result = await sdk.client.experimental.workspace.create({
      id,
      branch: null,
      config: (type === "worktree" ? { type, directory } : { type }) as never,
    })
    if (!result.data) {
      setCreating(false)
      toast.show({ message: "Failed to create workspace", variant: "error" })
      return
    }
    await props.onDone(result.data.id)
    setCreating(false)
  }

  return (
    <DialogSelect
      title={creating() ? "Creating workspace" : "New workspace"}
      skipFilter={true}
      options={
        creating()
          ? [{ title: "Creating workspace...", value: "creating", description: "This may take a moment" }]
          : (adaptors() ?? []).map((item) => ({
              title: item.name,
              value: item.type,
              description: item.description,
            }))
      }
      onSelect={(option) => {
        if (option.value === "creating") return
        void createWorkspace(option.value)
      }}
    />
  )
}

export function DialogWorkspaceList(props: { sessionID?: string }) {
  const dialog = useDialog()
  const route = useRoute()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const keybind = useKeybind()

  const [toDelete, setToDelete] = createSignal<string>()
  const [counts, setCounts] = createSignal<CountState>({})

  const status = (workspaceID?: string) => {
    if (!workspaceID) return "connected"
    return sync.data.workspace_status[workspaceID] ?? "connecting"
  }

  const footer = (workspaceID: string | undefined, count: number | null | undefined) => {
    const label = status(workspaceID)
    if (count === undefined) return `${label} · Loading sessions...`
    if (count === null) return `${label} · Sessions unavailable`
    return `${label} · ${count} session${count === 1 ? "" : "s"}`
  }

  const [workspaces, workspacesCtrl] = createResource(async () => {
    const result = await sdk.client.experimental.workspace.list()
    return result.data ?? []
  })

  const countSessions = async (workspace?: { id: string; config: { type: string } }) => {
    const result = await sdk.clientFor(workspace?.id).session.list({ roots: true, limit: 200 })
    const list = result.data ?? []
    if (workspace && workspace.config.type !== "worktree") return list.length
    if (workspace?.id)
      return list.filter((item) => (item as { workspaceID?: string }).workspaceID === workspace.id).length
    return list.filter((item) => !(item as { workspaceID?: string }).workspaceID).length
  }

  const refreshCounts = async (items: NonNullable<ReturnType<typeof workspaces>>) => {
    const entries = await Promise.all([
      countSessions()
        .then((count) => ["__local__", count] as const)
        .catch(() => ["__local__", null] as const),
      ...items.map((workspace) =>
        countSessions(workspace)
          .then((count) => [workspace.id, count] as const)
          .catch(() => [workspace.id, null] as const),
      ),
    ])
    setCounts(Object.fromEntries(entries))
  }

  createEffect(() => {
    const listed = workspaces()
    if (!listed) return
    void refreshCounts(listed)
  })

  const currentWorkspaceID = createMemo(() => route.data.workspaceID ?? "__local__")

  const openWorkspaceHome = async (workspaceID?: string) => {
    route.navigate({ type: "home", workspaceID })
    await sync.bootstrap()
    dialog.clear()
  }

  onMount(() => {
    dialog.setSize("large")
  })

  const warp = async (workspaceID?: string) => {
    if (!props.sessionID) return false
    const current = route.data.type === "session" ? route.data.workspaceID : undefined
    if (current === workspaceID) {
      dialog.clear()
      return true
    }

    const workspace = sdk.client.experimental.workspace as unknown as {
      warp(input: { id: string | null; sessionID: string }): Promise<{ data?: { workspaceID?: string } }>
    }
    const result = await workspace.warp({
      id: workspaceID ?? null,
      sessionID: props.sessionID,
    })
    if (!result.data) {
      toast.show({ message: "Failed to move session", variant: "error" })
      return false
    }

    route.navigate({
      type: "session",
      sessionID: props.sessionID,
      source: "switch",
      workspaceID,
    })
    await sync.bootstrap()
    dialog.clear()
    return true
  }

  const options = createMemo(() => [
    {
      title: "Local",
      value: "__local__",
      category: "Workspace",
      description: "Use the local machine",
      footer: footer(undefined, counts()["__local__"]),
    },
    ...(workspaces() ?? []).map((workspace) => ({
      title:
        toDelete() === workspace.id
          ? `Delete ${workspace.id}? Press ${keybind.print("session_delete")} again`
          : workspace.id,
      value: workspace.id,
      category: workspace.config.type,
      description: workspace.branch
        ? `Branch ${workspace.branch}`
        : typeof workspace.config.directory === "string"
          ? workspace.config.directory
          : workspace.id,
      footer: footer(workspace.id, counts()[workspace.id]),
    })),
    {
      title: "+ New workspace",
      value: "__create__",
      category: "Actions",
      description: "Create a new workspace",
    },
  ])

  return (
    <DialogSelect
      title={props.sessionID ? "Move session" : "Workspaces"}
      skipFilter={true}
      options={options()}
      current={currentWorkspaceID()}
      onMove={() => {
        setToDelete(undefined)
      }}
      onSelect={async (option) => {
        setToDelete(undefined)
        if (option.value === "__create__") {
          dialog.replace(() => (
            <DialogWorkspaceCreate
              onDone={async (workspaceID) => {
                await workspacesCtrl.refetch()
                if (props.sessionID) {
                  await warp(workspaceID)
                  return
                }
                await openWorkspaceHome(workspaceID)
              }}
            />
          ))
          return
        }
        if (option.value === "__local__") {
          if (props.sessionID) {
            await warp(undefined)
            return
          }
          if ((counts()["__local__"] ?? 0) > 0) {
            dialog.replace(() => <DialogSessionList workspaceID={null} />)
            return
          }
          await openWorkspaceHome(undefined)
          return
        }
        if (props.sessionID) {
          await warp(option.value)
          return
        }
        if ((counts()[option.value] ?? 0) > 0) {
          dialog.replace(() => <DialogSessionList workspaceID={option.value} />)
          return
        }
        await openWorkspaceHome(option.value)
      }}
      keybind={[
        {
          keybind: keybind.all.session_delete?.[0],
          title: "delete",
          onTrigger: async (option) => {
            if (option.value === "__create__" || option.value === "__local__") return
            if (toDelete() !== option.value) {
              setToDelete(option.value)
              return
            }
            const result = await sdk.client.experimental.workspace.remove({ id: option.value })
            setToDelete(undefined)
            if (result.error) {
              toast.show({ message: "Failed to delete workspace", variant: "error" })
              return
            }
            if (currentWorkspaceID() === option.value) {
              route.navigate({ type: "home" })
              await sync.bootstrap()
            }
            await workspacesCtrl.refetch()
          },
        },
      ]}
    />
  )
}
