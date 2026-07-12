const disposers = new Set<(directory: string) => Promise<void>>()
const stores = new Set<() => Promise<void>>()

export function registerDisposer(disposer: (directory: string) => Promise<void>) {
  disposers.add(disposer)
  return () => {
    disposers.delete(disposer)
  }
}

export async function disposeInstance(directory: string) {
  await Promise.allSettled([...disposers].map((disposer) => disposer(directory)))
}

export function registerInstanceStore(dispose: () => Promise<void>) {
  stores.add(dispose)
  return () => {
    stores.delete(dispose)
  }
}

export async function disposeInstanceStores() {
  await Promise.all([...stores].map((dispose) => dispose()))
}
