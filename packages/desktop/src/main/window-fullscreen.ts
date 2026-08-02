import type { BrowserWindow } from "electron"

type Window = Pick<
  BrowserWindow,
  "isDestroyed" | "isFullScreen" | "setFullScreen" | "on" | "once" | "removeListener"
> & {
  webContents: Pick<BrowserWindow["webContents"], "isDestroyed" | "send">
}

export function getWindowFullscreen(win?: Pick<BrowserWindow, "isFullScreen"> | null) {
  return win?.isFullScreen() ?? false
}

export function toggleWindowFullscreen(win?: Pick<BrowserWindow, "isFullScreen" | "setFullScreen"> | null) {
  if (!win) return
  win.setFullScreen(!win.isFullScreen())
}

export function wireWindowFullscreen(win: Window) {
  const send = (fullscreen: boolean) => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return
    win.webContents.send("window-fullscreen-changed", fullscreen)
  }
  const enter = () => send(true)
  const leave = () => send(false)
  const clear = () => {
    win.removeListener("enter-full-screen", enter)
    win.removeListener("leave-full-screen", leave)
    win.removeListener("closed", clear)
  }

  win.on("enter-full-screen", enter)
  win.on("leave-full-screen", leave)
  win.once("closed", clear)
  return clear
}
