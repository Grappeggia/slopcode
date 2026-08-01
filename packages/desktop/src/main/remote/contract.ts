import type { RemoteHost, RemoteWorkspaceSsh } from "../../../../protocol/src/remote"

export type DesktopRemoteHost = RemoteHost & { mode: "ssh" }
export type DesktopRemoteWorkspace = RemoteWorkspaceSsh

export type DesktopWorkspaceID = string & { readonly __brand: "DesktopWorkspaceID" }

export const DesktopWorkspaceID = {
  make(value: string) {
    return value as DesktopWorkspaceID
  },
}

export type DesktopSshHostKey =
  | {
      kind: "known_hosts"
      path: string
    }
  | {
      kind: "pinned"
      value: string
    }

export type DesktopSshSecurity = {
  hostKey: DesktopSshHostKey
  identityPath?: string
}

export type DesktopSshTarget = {
  host: DesktopRemoteHost
  workspace: DesktopRemoteWorkspace
  security: DesktopSshSecurity
}

export type DesktopRemoteValidation = {
  directory: string
}

type StateBase = {
  id: DesktopWorkspaceID
  host: DesktopRemoteHost
  workspace: DesktopRemoteWorkspace
}

export type DesktopRemoteState =
  | ({
      kind: "validating"
    } & StateBase)
  | ({
      kind: "starting"
    } & StateBase)
  | ({
      kind: "ready"
      url: string
      username: string
      password: string
      attached: boolean
    } & StateBase)
  | ({
      kind: "stopped"
    } & StateBase)
  | ({
      kind: "failed"
      message: string
    } & StateBase)

export type DesktopRemoteEvent = {
  type: "state"
  state: DesktopRemoteState
}

export type DesktopRemoteReady = Extract<DesktopRemoteState, { kind: "ready" }>

export type DesktopRemoteHostService = {
  getState: (id: DesktopWorkspaceID) => DesktopRemoteState | undefined
  subscribe: (listener: (event: DesktopRemoteEvent) => void) => () => void
  validateWorkspace: (target: DesktopSshTarget) => Promise<DesktopRemoteValidation>
  ensureWorkspace: (target: DesktopSshTarget) => Promise<DesktopRemoteReady>
  stopWorkspace: (id: DesktopWorkspaceID) => Promise<void>
  stopAll: () => Promise<void>
}
