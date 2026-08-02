type ReorderEvent = Pick<KeyboardEvent, "altKey" | "key" | "preventDefault" | "shiftKey">

export function handleTabReorder(event: ReorderEvent, move: (offset: -1 | 1) => void) {
  if (!event.altKey || !event.shiftKey) return false
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return false
  event.preventDefault()
  move(event.key === "ArrowLeft" ? -1 : 1)
  return true
}
