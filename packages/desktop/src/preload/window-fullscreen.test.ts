import { describe, expect, test } from "bun:test"
import { onWindowFullscreenChanged } from "./window-fullscreen"

describe("fullscreen preload subscription", () => {
  test("forwards changes and removes the exact listener on cleanup", () => {
    const listeners = new Set<(event: unknown, fullscreen: boolean) => void>()
    const ipc = {
      on: (_channel: string, listener: (event: unknown, fullscreen: boolean) => void) => listeners.add(listener),
      removeListener: (_channel: string, listener: (event: unknown, fullscreen: boolean) => void) =>
        listeners.delete(listener),
    }
    const values: boolean[] = []
    const clear = onWindowFullscreenChanged(ipc, (fullscreen) => values.push(fullscreen))

    listeners.forEach((listener) => listener(undefined, true))
    expect(values).toEqual([true])
    clear()
    expect(listeners.size).toBe(0)
  })
})
