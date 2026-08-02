export function focusDebugRequested(value = process.env.SLOPCODE_FOCUS_DEBUG) {
  return value === "1" || value === "true"
}
