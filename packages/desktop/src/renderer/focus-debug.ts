export function createFocusDebugAction(dev: boolean, enabled: boolean, action: (enabled: boolean) => Promise<void>) {
  if (!dev || !enabled) return
  return action
}
