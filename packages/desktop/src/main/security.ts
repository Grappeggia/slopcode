import type { BrowserWindow, IpcMain, IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron"
import { isTrustedRendererUrl as isTrusted, safeExternalUrl } from "../security"

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent
type Authorization = ReturnType<typeof createIpcAuthorization>
let development: string | undefined

export function isTrustedRendererUrl(value?: string, dev = development) {
  return isTrusted(value, dev)
}

export function protectNavigation(contents: WebContents, openExternal: (url: string) => unknown, dev?: string) {
  const open = (value: string) => {
    const url = safeExternalUrl(value)
    if (url) void openExternal(url)
  }

  contents.on("will-frame-navigate", (event) => {
    if (isTrusted(event.url, dev)) return
    event.preventDefault()
    if (event.isMainFrame) open(event.url)
  })
  contents.on("will-redirect", (event) => {
    if (isTrusted(event.url, dev)) return
    event.preventDefault()
  })
  contents.setWindowOpenHandler((details) => {
    if (isTrusted(details.url, dev)) {
      void contents.loadURL(details.url)
      return { action: "deny" }
    }
    open(details.url)
    return { action: "deny" }
  })
}

export function createIpcAuthorization() {
  const senders = new WeakSet<WebContents>()
  let dev: string | undefined

  return {
    configure(value?: string) {
      dev = value
    },
    add(sender: WebContents) {
      senders.add(sender)
      sender.once("destroyed", () => senders.delete(sender))
    },
    has(sender: WebContents) {
      return senders.has(sender) && !sender.isDestroyed()
    },
    allows(event: IpcEvent) {
      if (!senders.has(event.sender) || event.sender.isDestroyed()) return false
      const frame = event.senderFrame
      if (!frame || frame.isDestroyed() || frame.detached) return false
      const main = event.sender.mainFrame
      if (main.isDestroyed() || main.detached) return false
      if (frame.processId !== main.processId || frame.routingId !== main.routingId) return false
      return isTrusted(frame.url, dev)
    },
  }
}

export const ipcAuthorization = createIpcAuthorization()

export function protectWindow(win: BrowserWindow, openExternal: (url: string) => unknown, dev?: string) {
  development = dev
  ipcAuthorization.configure(dev)
  ipcAuthorization.add(win.webContents)
  protectNavigation(win.webContents, openExternal, dev)
}

export function guardIpc(main: Pick<IpcMain, "handle" | "on">, authorization: Authorization = ipcAuthorization) {
  return {
    handle<Args extends unknown[], Result>(
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: Args) => Result,
    ) {
      main.handle(channel, (event, ...args) => {
        if (!authorization.allows(event)) throw new Error(`Unauthorized IPC sender for ${channel}`)
        return listener(event, ...(args as Args))
      })
    },
    on<Args extends unknown[]>(channel: string, listener: (event: IpcMainEvent, ...args: Args) => void) {
      main.on(channel, (event, ...args) => {
        if (!authorization.allows(event)) return
        listener(event, ...(args as Args))
      })
    },
  }
}
