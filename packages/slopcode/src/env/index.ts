import { Instance } from "../project/instance"

type Scope = {
  sessionID?: string
}

type State = {
  base: Record<string, string | undefined>
  global: Record<string, string | undefined>
  session: Record<string, Record<string, string | undefined>>
}

export namespace Env {
  const state = Instance.state<State>(() => ({
    base: { ...process.env } as Record<string, string | undefined>,
    global: {},
    session: {},
  }))

  function local(input?: Scope) {
    if (!input?.sessionID) return state().global
    state().session[input.sessionID] ??= {}
    return state().session[input.sessionID]
  }

  export function get(key: string, input?: Scope) {
    const env = state()
    if (input?.sessionID) {
      const session = env.session[input.sessionID]
      if (session && key in session) return session[key]
    }
    if (key in env.global) return env.global[key]
    return env.base[key]
  }

  export function all(input?: Scope) {
    const env = state()
    return Object.fromEntries(
      Object.entries({
        ...env.base,
        ...env.global,
        ...(input?.sessionID ? (env.session[input.sessionID] ?? {}) : {}),
      }).filter((entry): entry is [string, string] => entry[1] !== undefined),
    )
  }

  export function set(key: string, value: string, input?: Scope) {
    local(input)[key] = value
  }

  export function merge(values: Record<string, string>, input?: Scope) {
    Object.assign(local(input), values)
  }

  export function remove(key: string, input?: Scope) {
    delete local(input)[key]
  }

  export function clear(sessionID: string) {
    delete state().session[sessionID]
  }
}
