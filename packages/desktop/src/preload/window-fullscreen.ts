type Ipc = {
  on: (channel: string, listener: (event: unknown, fullscreen: boolean) => void) => unknown
  removeListener: (channel: string, listener: (event: unknown, fullscreen: boolean) => void) => unknown
}

export function onWindowFullscreenChanged(ipc: Ipc, cb: (fullscreen: boolean) => void) {
  const handler = (_: unknown, fullscreen: boolean) => cb(fullscreen)
  ipc.on("window-fullscreen-changed", handler)
  return () => ipc.removeListener("window-fullscreen-changed", handler)
}
