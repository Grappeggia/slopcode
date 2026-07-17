import type { PermissionSavedInfo } from "@slopcode-ai/sdk/v2"
import { createMemo, createSignal, onMount } from "solid-js"
import { useProject } from "../context/project"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { useToast } from "../ui/toast"
import { errorMessage } from "../util/error"
import {
  permissionRemove,
  permissionRemoveStep,
  permissionSavedList,
  permissionSavedRemove,
  permissionSavedRows,
} from "./dialog-permissions.shared"

export function DialogPermissions() {
  const dialog = useDialog()
  const sdk = useSDK()
  const project = useProject()
  const toast = useToast()
  const { theme } = useTheme()
  const [items, setItems] = createSignal<PermissionSavedInfo[]>([])
  const [loading, setLoading] = createSignal(false)
  const [confirming, setConfirming] = createSignal<string>()
  const [removing, setRemoving] = createSignal<string>()
  const scope = createMemo(() => (project.data.project.vcs === "git" ? "project" : "folder"))

  async function load() {
    setItems(await permissionSavedList(sdk.client, project.workspace.current()))
  }

  async function refresh() {
    setLoading(true)
    try {
      await load()
    } catch (error) {
      toast.show({ variant: "error", title: "Failed to load saved permissions", message: errorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  async function remove(item: PermissionSavedInfo) {
    if (removing()) return
    const step = permissionRemoveStep(confirming(), item.id)
    setConfirming(step.confirming)
    if (!step.remove) return

    setRemoving(item.id)
    const result = await permissionRemove({
      remove: () => permissionSavedRemove(sdk.client, item.id, project.workspace.current()).then(() => ({})),
      refresh: load,
    })
    if (result.status === "remove_failed") {
      toast.show({ variant: "error", title: "Failed to revoke saved permission", message: errorMessage(result.error) })
    }
    if (result.status === "refresh_failed") {
      setItems((current) => current.filter((saved) => saved.id !== item.id))
      toast.show({
        variant: "error",
        title: "Failed to refresh saved permissions",
        message: errorMessage(result.error),
      })
    }
    setRemoving(undefined)
  }

  const rows = createMemo<DialogSelectOption<PermissionSavedInfo>[]>(() =>
    permissionSavedRows(items(), { scope: scope(), confirming: confirming(), removing: removing() }).map((row) => ({
      title: row.title,
      category: row.category,
      value: row.item,
      description: row.description,
      footer: row.footer,
      bg: confirming() === row.id ? theme.error : undefined,
    })),
  )

  onMount(() => {
    dialog.setSize("large")
    void refresh()
  })

  return (
    <DialogSelect
      title={`Permissions for this ${scope()}`}
      placeholder={loading() ? "Loading permissions" : "Search permissions"}
      options={rows()}
      footer={!loading() && items().length === 0 ? `No saved permissions for this ${scope()}.` : undefined}
      onMove={() => setConfirming(undefined)}
      actions={[
        {
          command: "dialog.permission.delete",
          title: "delete",
          onTrigger: (option) => void remove(option.value),
        },
      ]}
    />
  )
}
