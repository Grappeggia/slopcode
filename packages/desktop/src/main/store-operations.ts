type Operation<T> = () => T | PromiseLike<T>

export function createStoreOperationQueue() {
  const pending = new Map<string, Promise<void>>()

  return function run<T>(name: string, operation: Operation<T>) {
    const previous = pending.get(name) ?? Promise.resolve()
    const current = previous.then(operation)
    const next = current.then(
      () => undefined,
      () => undefined,
    )
    pending.set(name, next)
    return current.finally(() => {
      if (pending.get(name) === next) pending.delete(name)
    })
  }
}
