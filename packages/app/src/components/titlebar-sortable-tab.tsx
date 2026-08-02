import { createSortable } from "@thisbeyond/solid-dnd"
import type { ParentProps } from "solid-js"
import { handleTabReorder } from "./titlebar-tab-keyboard"

export function SortableTitlebarTab(
  props: ParentProps<{
    id: string
    label: string
    position: number
    total: number
    onMove: (offset: -1 | 1) => void
  }>,
) {
  const sortable = createSortable(props.id)
  const move = (event: KeyboardEvent) => handleTabReorder(event, props.onMove)

  return (
    <div
      use:sortable
      data-titlebar-tab-slot
      role="group"
      aria-label={`${props.label}, ${props.position} of ${props.total}`}
      aria-roledescription="sortable tab"
      aria-describedby="titlebar-tab-reorder-instructions"
      onKeyDown={move}
      class="flex min-w-0 flex-row items-center gap-1.5"
      classList={{ "opacity-40": sortable.isActiveDraggable }}
    >
      {props.children}
    </div>
  )
}
