export function sessionStripActionNeedsSeparator(input: { hidden: number; next?: string }) {
  return input.hidden > 0 || !!input.next
}

export function sessionStripShouldShowHidden(input: { tabs: number; hidden: number; action: boolean }) {
  if (input.hidden === 0) return false
  if (!input.action) return true
  return input.tabs > 0
}
