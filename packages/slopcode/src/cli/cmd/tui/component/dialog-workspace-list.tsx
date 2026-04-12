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

function DialogWorkspaceCreate(props: { onDone: (workspaceID: string) => Promise<void> }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const [creating, setCreating] = createSignal(false)

  onMount(() => {
    dialog.setSize("medium")
  })

  const createWorkspace = async () => {
    if (creating()) return
    setCreating(true)
    const id = Identifier.ascending("workspace")
    const directory = sync.data.path.worktree || sync.data.path.directory || sdk.directory || process.cwd()
    const result = await sdk.client.experimental.workspace.create({
      id,
      branch: null,
      config: { type: "worktree", directory },
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
          ? [{ title: "Creating worktree...", value: "creating", description: "This may take a moment" }]
          : [{ title: "Worktree", value: "worktree", description: "Create a local git worktree" }]
      }
      onSelect={(option) => {
        if (option.value === "creating") return
        void createWorkspace()
      }}
    />
  )
}

export function DialogWorkspaceList() {
  const dialog = useDialog()
  const route = useRoute()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const keybind = useKeybind()

  const [toDelete, setToDelete] = createSignal<string>()
  const [counts, setCounts] = createSignal<CountState>({})

  const [workspaces, workspacesCtrl] = createResource(async () => {
    const result = await sdk.client.experimental.workspace.list()
    return result.data ?? []
  })

  const localClient = () => sdk.clientFor(undefined)

  const refreshCounts = async (items: NonNullable<ReturnType<typeof workspaces>>) => {
    const entries = await Promise.all([
      localClient()
        .session.list({ roots: true, limit: 1 })
        .then((result) => ["__local__", result.data?.length ?? 0] as const)
        .catch(() => ["__local__", null] as const),
      ...items.map((workspace) =>
        sdk
          .clientFor(workspace.id)
          .session.list({ roots: true, limit: 1 })
          .then((result) => [workspace.id, result.data?.length ?? 0] as const)
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

  const options = createMemo(() => [
    {
      title: "Local",
      value: "__local__",
      category: "Workspace",
      description: "Use the local machine",
      footer:
        counts()["__local__"] === undefined
          ? "Loading sessions..."
          : counts()["__local__"] === null
            ? "Sessions unavailable"
            : `${counts()["__local__"]} session${counts()["__local__"] === 1 ? "" : "s"}`,
    },
    ...(workspaces() ?? []).map((workspace) => ({
      title:
        toDelete() === workspace.id
          ? `Delete ${workspace.id}? Press ${keybind.print("session_delete")} again`
          : workspace.id,
      value: workspace.id,
      category: workspace.config.type,
      description: workspace.branch ? `Branch ${workspace.branch}` : workspace.config.directory,
      footer:
        counts()[workspace.id] === undefined
          ? "Loading sessions..."
          : counts()[workspace.id] === null
            ? "Sessions unavailable"
            : `${counts()[workspace.id]} session${counts()[workspace.id] === 1 ? "" : "s"}`,
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
      title="Workspaces"
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
                await openWorkspaceHome(workspaceID)
              }}
            />
          ))
          return
        }
        if (option.value === "__local__") {
          if ((counts()["__local__"] ?? 0) > 0) {
            dialog.replace(() => <DialogSessionList workspaceID={null} />)
            return
          }
          await openWorkspaceHome(undefined)
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
