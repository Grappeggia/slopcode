import { describe, expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { getWindowFullscreen, toggleWindowFullscreen, wireWindowFullscreen } from "./window-fullscreen"

class Window extends EventEmitter {
  destroyed = false
  fullscreen = false
  sent: Array<[string, boolean]> = []
  webContents = {
    isDestroyed: () => this.destroyed,
    send: (channel: string, fullscreen: boolean) => this.sent.push([channel, fullscreen]),
  }

  isDestroyed() {
    return this.destroyed
  }

  isFullScreen() {
    return this.fullscreen
  }

  setFullScreen(fullscreen: boolean) {
    this.fullscreen = fullscreen
  }
}

describe("desktop window fullscreen", () => {
  test("reads the current native state", () => {
    const win = new Window()
    win.fullscreen = true
    expect(getWindowFullscreen(win as never)).toBe(true)
    expect(getWindowFullscreen()).toBe(false)
  })

  test("forwards native enter and leave events and removes listeners when closed", () => {
    const win = new Window()
    wireWindowFullscreen(win as never)

    win.emit("enter-full-screen")
    win.emit("leave-full-screen")
    expect(win.sent).toEqual([
      ["window-fullscreen-changed", true],
      ["window-fullscreen-changed", false],
    ])

    win.emit("closed")
    win.emit("enter-full-screen")
    expect(win.sent).toHaveLength(2)
    expect(win.listenerCount("enter-full-screen")).toBe(0)
    expect(win.listenerCount("leave-full-screen")).toBe(0)
  })

  test("menu fullscreen toggling uses the current native state", () => {
    const win = new Window()
    toggleWindowFullscreen(win as never)
    expect(win.fullscreen).toBe(true)
    toggleWindowFullscreen(win as never)
    expect(win.fullscreen).toBe(false)
  })
})
