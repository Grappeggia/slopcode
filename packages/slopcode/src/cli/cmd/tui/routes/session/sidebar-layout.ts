export const SESSION_SIDEBAR_WIDTH = 42
export const SESSION_SIDEBAR_RAIL_WIDTH = 6

type SidebarLayout = {
  visible: boolean
  wide: boolean
  collapsed: boolean
}

export function sessionSidebarWidth(input: SidebarLayout) {
  if (!input.visible) return 0
  if (input.wide && input.collapsed) return SESSION_SIDEBAR_RAIL_WIDTH
  return SESSION_SIDEBAR_WIDTH
}

export function sessionMainWidth(total: number, input: SidebarLayout) {
  if (total <= 0) return 0
  if (!input.visible) return total
  if (!input.wide) return total
  return Math.max(0, total - sessionSidebarWidth(input))
}

export function sessionSidebarExpanded(input: SidebarLayout) {
  if (!input.visible) return false
  if (!input.wide) return true
  return !input.collapsed
}

export function sessionSidebarHeaderVisible(input: SidebarLayout) {
  return !sessionSidebarExpanded(input)
}
