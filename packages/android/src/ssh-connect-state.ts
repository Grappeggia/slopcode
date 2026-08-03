import { normalizeSshTarget, parseSshTarget, sshProfile, validSshPath, type SshAgent, type SshCredential } from "./ssh"

export type SshConnectAuth = "password" | "privateKey"

type CredentialStore = {
  credentialGet(profile: string): Promise<SshCredential | undefined>
}

export function emptySshCredentials(auth: SshConnectAuth = "password") {
  return {
    auth,
    password: "",
    privateKey: "",
    privateKeyLabel: "",
    passphrase: "",
  }
}

export function resetSshOnboarding(auth: SshConnectAuth = "password") {
  return {
    ...emptySshCredentials(auth),
    pendingKey: undefined,
    connected: false,
    connectedProfile: undefined,
    connectedDirectory: undefined,
    busy: false,
    browseBusy: false,
    step: "auth" as const,
    directory: "",
    homePath: "/",
    listing: undefined,
    browsePath: "/",
    browseOpen: true,
    query: "",
    showHidden: false,
    error: "",
    preflight: undefined,
    setup: undefined,
    setupInput: "",
    checkingLogin: false,
    agentStatuses: {},
  }
}

export function connectedSshWorkspace(input: {
  connected: boolean
  connectedProfile?: string
  connectedDirectory?: string
  target: string
  directory: string
  agent: SshAgent
}) {
  if (!input.connected) return
  const target = normalizeSshTarget(input.target)
  const parsed = target ? parseSshTarget(target) : undefined
  const profile = target && parsed ? sshProfile(target, parsed.port ?? 22) : undefined
  const directory = validSshPath(input.directory)
  if (!target || !profile || !directory || profile !== input.connectedProfile || directory !== input.connectedDirectory)
    return
  return { target, directory, agent: input.agent }
}

export function createSshCredentialLoader(store: CredentialStore) {
  let revision = 0

  return {
    invalidate() {
      revision += 1
    },
    async load(profile: string, current: () => string | undefined, apply: (credential: SshCredential) => void) {
      const request = ++revision
      const credential = await store.credentialGet(profile).catch(() => undefined)
      if (!credential || request !== revision || current() !== profile) return false
      apply(credential)
      return true
    },
  }
}

export function createSshOnboardingGeneration() {
  let value = 0

  return {
    current() {
      return value
    },
    advance() {
      value += 1
      return value
    },
    matches(request: number) {
      return request === value
    },
  }
}
