import { describe, expect, test } from "bun:test"
import {
  connectedSshWorkspace,
  createSshConnectionGate,
  createSshCredentialLoader,
  createSshOnboardingGeneration,
  leaveSshOnboarding,
  resetSshOnboarding,
} from "./ssh-connect-state"

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe("SSH onboarding transitions", () => {
  test("clears credentials, pending verification, setup, and errors when changing computers or auth methods", () => {
    const password = resetSshOnboarding()
    const key = resetSshOnboarding("privateKey")

    expect(password).toMatchObject({
      auth: "password",
      password: "",
      privateKey: "",
      privateKeyLabel: "",
      passphrase: "",
      pendingKey: undefined,
      setup: undefined,
      error: "",
      connected: false,
      directory: "",
    })
    expect(key.auth).toBe("privateKey")
    expect(key.showHidden).toBeFalse()
  })

  test("binds late credential reads to the currently selected saved profile", async () => {
    const first = deferred<{ auth: "password"; password: string } | undefined>()
    const second = deferred<{ auth: "privateKey"; privateKey: string } | undefined>()
    const store = {
      credentialGet: (profile: string) => (profile === "marcos@one:22" ? first.promise : second.promise),
    }
    const loader = createSshCredentialLoader(store)
    const values: string[] = []
    let profile = "marcos@one:22"

    const old = loader.load(
      "marcos@one:22",
      () => profile,
      (credential) => values.push(credential.auth),
    )
    profile = "marcos@two:22"
    const next = loader.load(
      "marcos@two:22",
      () => profile,
      (credential) => values.push(credential.auth),
    )
    first.resolve({ auth: "password", password: "secret" })
    second.resolve({ auth: "privateKey", privateKey: "-----BEGIN PRIVATE KEY-----" })

    expect(await old).toBeFalse()
    expect(await next).toBeTrue()
    expect(values).toEqual(["privateKey"])
  })

  test("does not replace manually edited credentials for the same saved profile", async () => {
    const result = deferred<{ auth: "password"; password: string } | undefined>()
    const loader = createSshCredentialLoader({ credentialGet: () => result.promise })
    const values: string[] = []
    const request = loader.load(
      "marcos@mac.example.com:22",
      () => "marcos@mac.example.com:22",
      (credential) => {
        if (credential.auth === "password") values.push(credential.password)
      },
    )

    loader.invalidate()
    result.resolve({ auth: "password", password: "saved-password" })

    expect(await request).toBeFalse()
    expect(values).toEqual([])
  })

  test("invalidates every in-flight onboarding operation after a transition", () => {
    const generation = createSshOnboardingGeneration()
    const request = generation.current()

    generation.advance()

    expect(generation.matches(request)).toBeFalse()
    expect(generation.matches(generation.current())).toBeTrue()
  })

  test("cleans up a stale native connection", async () => {
    const calls: string[] = []
    const gate = createSshConnectionGate({
      status: async () => ({ connected: true, profile: "marcos@mac.example.com:22" }),
      disconnect: async () => void calls.push("disconnect"),
    })
    const stale = gate.start()

    expect(await gate.cleanup(stale, "marcos@mac.example.com:22")).toBeTrue()
    expect(calls).toEqual(["disconnect"])
  })

  test("does not disconnect a newer connection while stale cleanup is pending", async () => {
    const calls: string[] = []
    const status = deferred<{ connected: boolean; profile?: string }>()
    const gate = createSshConnectionGate({
      status: async () => status.promise,
      disconnect: async () => void calls.push("disconnect"),
    })
    const old = gate.start()
    const cleanup = gate.cleanup(old, "marcos@mac.example.com:22")

    gate.start()
    status.resolve({ connected: true, profile: "marcos@mac.example.com:22" })

    expect(await cleanup).toBeFalse()
    expect(calls).toEqual([])
  })

  test("finishes an intentional disconnect despite an unrelated onboarding transition", async () => {
    const calls: string[] = []
    const gate = createSshConnectionGate({
      status: async () => ({ connected: true, profile: "marcos@mac.example.com:22" }),
      disconnect: async () => void calls.push("disconnect"),
    })
    const generation = createSshOnboardingGeneration()
    const request = gate.start()

    generation.advance()

    expect(await gate.close(request)).toBeTrue()
    expect(calls).toEqual(["disconnect"])
  })

  test("clears connected workspace state before a pending disconnect can observe a folder change", async () => {
    const closing = deferred<undefined>()
    const gate = createSshConnectionGate({
      status: async () => ({ connected: true, profile: "marcos@mac.example.com:22" }),
      disconnect: async () => closing.promise,
    })
    const disconnect = gate.close(gate.start())
    const state = resetSshOnboarding()
    const folder = "/Users/marcos/another-workspace"

    expect(
      connectedSshWorkspace({
        connected: state.connected,
        connectedProfile: state.connectedProfile,
        connectedDirectory: folder,
        target: "marcos@mac.example.com",
        directory: folder,
        agent: "slopcode-cli",
      }),
    ).toBeUndefined()
    closing.resolve(undefined)
    expect(await disconnect).toBeTrue()
  })

  test("leaves before a deferred disconnect and preserves a newer workspace attempt", async () => {
    const closing = deferred<undefined>()
    const calls: string[] = []
    const gate = createSshConnectionGate({
      status: async () => ({ connected: true, profile: "marcos@mac.example.com:22" }),
      disconnect: async () => {
        calls.push("disconnect")
        return closing.promise
      },
    })
    const generation = createSshOnboardingGeneration()
    let state = {
      connected: true,
      profile: "marcos@mac.example.com:22",
      directory: "/Users/marcos/old-workspace",
      agent: "slopcode-cli",
    }
    const leave = leaveSshOnboarding({
      connections: gate,
      onboarding: generation,
      reset: () => {
        const next = resetSshOnboarding()
        state = { connected: next.connected, profile: "", directory: next.directory, agent: "slopcode-cli" }
      },
    })

    await Promise.resolve()
    expect(calls).toEqual(["disconnect"])
    expect(state.connected).toBeFalse()
    const newer = gate.start()
    const ready = gate.ready(newer)
    state = {
      connected: true,
      profile: "marcos@mac.example.com:22",
      directory: "/Users/marcos/new-workspace",
      agent: "codex-cli",
    }
    closing.resolve(undefined)

    expect(await leave).toBeFalse()
    expect(await ready).toBeTrue()
    expect(state).toEqual({
      connected: true,
      profile: "marcos@mac.example.com:22",
      directory: "/Users/marcos/new-workspace",
      agent: "codex-cli",
    })
  })

  test("does not expose a draft computer or mismatched folder in shell navigation", () => {
    const input = {
      connected: true,
      connectedProfile: "marcos@mac.example.com:22",
      connectedDirectory: "/Users/marcos/temp",
      target: "marcos@mac.example.com",
      directory: "/Users/marcos/temp",
      agent: "slopcode-cli" as const,
    }

    expect(connectedSshWorkspace(input)).toEqual({
      target: "marcos@mac.example.com",
      directory: "/Users/marcos/temp",
      agent: "slopcode-cli",
    })
    expect(connectedSshWorkspace({ ...input, target: "marcos@other.example.com" })).toBeUndefined()
    expect(connectedSshWorkspace({ ...input, directory: "/Users/marcos/draft" })).toBeUndefined()
    expect(connectedSshWorkspace({ ...input, connected: false })).toBeUndefined()
  })
})
