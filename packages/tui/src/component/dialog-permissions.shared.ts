import type { PermissionSavedInfo, SlopcodeClient } from "@slopcode-ai/sdk/v2"

type Result<T> = { data?: T; error?: unknown }
type Scope = "project" | "folder"

function options(workspace?: string) {
  return workspace ? { headers: { "x-slopcode-workspace": workspace } } : undefined
}

export async function permissionSavedList(client: SlopcodeClient, workspace?: string) {
  const result = await client.v2.permission.saved.list(undefined, options(workspace))
  if (result.error) throw result.error
  return (result.data?.data ?? []).toSorted((a, b) =>
    a.action === b.action ? a.resource.localeCompare(b.resource) : a.action.localeCompare(b.action),
  )
}

export async function permissionSavedRemove(client: SlopcodeClient, id: string, workspace?: string) {
  const result = await client.v2.permission.saved.remove({ id }, options(workspace))
  if (result.error) throw result.error
}

export function permissionSavedRows(
  items: PermissionSavedInfo[],
  state: { scope: Scope; confirming?: string; removing?: string },
) {
  return items.map((item) => ({
    id: item.id,
    item,
    title: `${item.action}: ${item.resource}`,
    category: "Permission",
    description:
      state.removing === item.id
        ? "Revoking..."
        : state.confirming === item.id
          ? "Revoke this permission? Press delete again"
          : item.resource,
    footer: `Saved for this ${state.scope}`,
  }))
}

export function permissionRemoveStep(confirming: string | undefined, id: string) {
  if (confirming !== id) return { confirming: id, remove: false } as const
  return { confirming: undefined, remove: true } as const
}

export async function permissionRemove(input: {
  remove: () => Promise<Result<unknown>>
  refresh: () => Promise<void>
}) {
  const removed = await input.remove().then(
    (result) => (result.error ? { ok: false as const, error: result.error } : { ok: true as const }),
    (error) => ({ ok: false as const, error }),
  )
  if (!removed.ok) return { status: "remove_failed" as const, error: removed.error }

  const refreshed = await input.refresh().then(
    () => ({ ok: true as const }),
    (error) => ({ ok: false as const, error }),
  )
  if (!refreshed.ok) return { status: "refresh_failed" as const, error: refreshed.error }
  return { status: "removed" as const }
}
