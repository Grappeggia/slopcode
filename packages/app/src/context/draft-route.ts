// A draft can move between directories, while two drafts can share one directory.
// The provider identity therefore needs both dimensions.
export function draftRouteKey(draftID: string, directory: string) {
  return `${draftID}\u0000${directory}`
}
