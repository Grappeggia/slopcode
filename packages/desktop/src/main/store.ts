import Store from "electron-store"
import electron from "electron"

import { rmSync } from "node:fs"
import { join } from "node:path"
import { SETTINGS_STORE } from "./store-keys"
import { deleteStoreFileIfEmpty } from "./store-cleanup"
import { createStoreOperationQueue } from "./store-operations"
import { isRendererStoreName } from "./store-name"

const cache = new Map<string, Store>()
const queue = createStoreOperationQueue()

// We cannot instantiate the electron-store at module load time because
// module import hoisting causes this to run before app.setPath("userData", ...)
// in index.ts has executed, which would result in files being written to the default directory
// (e.g. bad: %APPDATA%\@slopcode-ai\desktop\slopcode.settings vs good: %APPDATA%\ai.slopcode.desktop.dev\slopcode.settings).
export function getStore(name = SETTINGS_STORE) {
  const cached = cache.get(name)
  if (cached) return cached
  const next = new Store({
    name,
    cwd: electron.app.getPath("userData"),
    fileExtension: "",
    accessPropertiesByDotNotation: false,
  })
  cache.set(name, next)
  return next
}

export function runStoreOperation<T>(name: string, operation: () => T | PromiseLike<T>) {
  return queue(name, operation)
}

export function removeStoreFileIfEmpty(name: string) {
  if (!isRendererStoreName(name)) return Promise.resolve()
  return runStoreOperation(name, async () => {
    const store = cache.get(name)
    if (store && Object.keys(store.store).length > 0) return
    if (await deleteStoreFileIfEmpty(electron.app.getPath("userData"), name)) cache.delete(name)
  })
}

export function removeStoreFile(name: string) {
  rmSync(join(electron.app.getPath("userData"), name), { force: true })
  cache.delete(name)
}
