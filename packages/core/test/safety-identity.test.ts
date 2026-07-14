import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { SafetyIdentity } from "../src/safety-identity"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe("SafetyIdentity", () => {
  test("uses account, OpenAI OAuth, then installation identity with source separation", () => {
    const identity = SafetyIdentity.fromSeed(Buffer.alloc(32, 7))
    const account = identity.identifier({ account: "acct_raw", openai: "oauth_raw" })
    expect(account).toBe("sc_nqvGDiY92evsK7ajwbNxfmosUghHUqsK04BLQfs8eCc")
    expect(account).toBe(identity.identifier({ account: "acct_raw" }))
    expect(account).not.toContain("acct_raw")
    expect(identity.identifier({ openai: "acct_raw" })).not.toBe(account)
    expect(identity.identifier({ openai: "oauth_raw" })).not.toBe(identity.identifier({}))
    expect(identity.identifier({})).toBe(identity.identifier({}))
  })

  test("creates one stable mode-0600 seed atomically and repairs permissions", async () => {
    const data = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-safety-"))
    dirs.push(data)
    const identities = await Promise.all(Array.from({ length: 8 }, () => SafetyIdentity.load(data)))
    expect(new Set(identities.map((identity) => identity.identifier({}))).size).toBe(1)

    const target = SafetyIdentity.seedPath(data)
    expect((await fs.stat(target.file)).mode & 0o777).toBe(0o600)
    expect((await fs.readdir(target.directory)).sort()).toEqual(["safety.key"])

    await fs.chmod(target.file, 0o644)
    expect((await SafetyIdentity.load(data)).identifier({})).toBe(identities[0]!.identifier({}))
    expect((await fs.stat(target.file)).mode & 0o777).toBe(0o600)
  })
})
