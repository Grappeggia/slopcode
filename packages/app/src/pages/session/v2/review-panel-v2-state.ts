import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"

export const reviewSidebarMin = 180
export const reviewSidebarMax = 360
export const reviewSidebarDefault = 240
export const reviewPanelV2Storage = Persist.global("review-panel-v2")

export function clampReviewSidebarWidth(width: number) {
  return Math.min(reviewSidebarMax, Math.max(reviewSidebarMin, width))
}

export function toggleReviewSidebar(opened: boolean) {
  return !opened
}

export function createReviewPanelV2State() {
  const [store, setStore, , ready] = persisted(
    reviewPanelV2Storage,
    createStore({
      opened: true,
      width: reviewSidebarDefault,
    }),
  )
  const [filter, setFilter] = createSignal("")

  return {
    opened: () => store.opened,
    width: () => store.width,
    ready,
    filter,
    setFilter,
    resize: (width: number) => setStore("width", clampReviewSidebarWidth(width)),
    toggle: () => setStore("opened", toggleReviewSidebar),
  }
}

export type ReviewPanelV2State = ReturnType<typeof createReviewPanelV2State>
