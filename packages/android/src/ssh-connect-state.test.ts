import { describe, expect, test } from "bun:test"
import { connectedSshWorkspace, createSshCredentialLoader, resetSshOnboarding } from "./ssh-connect-state"

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
