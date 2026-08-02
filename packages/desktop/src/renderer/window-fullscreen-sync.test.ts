import { describe, expect, test } from "bun:test"
import { syncWindowFullscreen } from "./window-fullscreen-sync"

function deferred<T>() {
  let resolve = (_value: T) => undefined
  const promise = new Promise<T>((done) => {
    resolve = (value) => {
      done(value)
    }
  })
  return { promise, resolve }
}

describe("renderer fullscreen synchronization", () => {
  test("applies initial state, native changes, and listener cleanup", async () => {
    let listener = (_fullscreen: boolean) => undefined
    let stopped = false
    const values: boolean[] = []
    const clear = syncWindowFullscreen(
      {
        getWindowFullscreen: async () => true,
        onWindowFullscreenChanged: (cb) => {
          listener = cb
          return () => {
            stopped = true
          }
        },
      },
      (fullscreen) => values.push(fullscreen),
    )

    await Promise.resolve()
    listener(false)
    expect(values).toEqual([true, false])
    clear()
    listener(true)
    expect(stopped).toBe(true)
    expect(values).toEqual([true, false])
  })

  test("does not overwrite a newer event with a stale initial read", async () => {
    const initial = deferred<boolean>()
    let listener = (_fullscreen: boolean) => undefined
    const values: boolean[] = []
    syncWindowFullscreen(
      {
        getWindowFullscreen: () => initial.promise,
        onWindowFullscreenChanged: (cb) => {
          listener = cb
          return () => undefined
        },
      },
      (fullscreen) => values.push(fullscreen),
    )

    listener(true)
    initial.resolve(false)
    await initial.promise
    await Promise.resolve()
    expect(values).toEqual([true])
  })
})
