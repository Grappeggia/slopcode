type Api = {
  getWindowFullscreen: () => Promise<boolean>
  onWindowFullscreenChanged: (cb: (fullscreen: boolean) => void) => () => void
}

export function syncWindowFullscreen(api: Api, set: (fullscreen: boolean) => void) {
  let revision = 0
  let disposed = false
  const stop = api.onWindowFullscreenChanged((fullscreen) => {
    if (disposed) return
    revision++
    set(fullscreen)
  })
  const initial = revision

  void api.getWindowFullscreen().then((fullscreen) => {
    if (disposed || revision !== initial) return
    set(fullscreen)
  })

  return () => {
    if (disposed) return
    disposed = true
    stop()
  }
}
