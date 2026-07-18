export const FOOTER_TRANSCRIPT_ROWS = 4
export const FOOTER_PANEL_CHROME_ROWS = 7
export const FOOTER_PANEL_SPACER_ROWS = 1
// At minimum height, the first content row replaces the decorative spacer.
export const FOOTER_PANEL_MIN_ROWS = FOOTER_PANEL_CHROME_ROWS
export const FOOTER_PERMISSION_MIN_ROWS = FOOTER_PANEL_MIN_ROWS + 2

export function footerPanelMinimum(input: {
  type: "panel" | "permission" | "question"
  narrow: boolean
  single?: boolean
}) {
  if (input.type === "permission") return FOOTER_PERMISSION_MIN_ROWS
  if (input.type === "question" && input.narrow && input.single === false) return FOOTER_PANEL_MIN_ROWS + 1
  return FOOTER_PANEL_MIN_ROWS
}

export function footerHeightPolicy(input: { terminal: number; preferred: number; minimum: number }) {
  const terminal = Number.isFinite(input.terminal) ? Math.max(0, Math.floor(input.terminal)) : 0
  const preferred = Number.isFinite(input.preferred) ? Math.max(0, Math.floor(input.preferred)) : 0
  const minimum = Math.min(preferred, Number.isFinite(input.minimum) ? Math.max(0, Math.floor(input.minimum)) : 0)

  return Math.min(preferred, Math.max(Math.min(minimum, terminal), terminal - FOOTER_TRANSCRIPT_ROWS))
}

export function footerMenuRows(height: number, maximum: number) {
  const available = Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0
  const limit = Number.isFinite(maximum) ? Math.max(1, Math.floor(maximum)) : 1
  return Math.max(1, Math.min(limit, available - FOOTER_PANEL_CHROME_ROWS))
}
