export const destroyedWindowURL = "<destroyed>"

type WebContentsURLState = {
  isDestroyed(): boolean
  getURL(): string
}

type WindowURLState = {
  isDestroyed(): boolean
  readonly webContents: WebContentsURLState
}

export function safeWebContentsURL(contents: WebContentsURLState) {
  try {
    if (contents.isDestroyed()) return destroyedWindowURL
    return contents.getURL()
  } catch {
    return destroyedWindowURL
  }
}

export function safeWindowURL(win: WindowURLState) {
  try {
    if (win.isDestroyed()) return destroyedWindowURL
    return safeWebContentsURL(win.webContents)
  } catch {
    return destroyedWindowURL
  }
}
