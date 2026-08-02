import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import type { Plugin } from "@slopcode-ai/plugin"
import { gitlabAuthPlugin } from "opencode-gitlab-auth"
import { PoeAuthPlugin } from "opencode-poe-auth"

import { tmpdir } from "../fixture/fixture"

type GitLabRuntimeModel = {
  config: {
    ensureApiKey(): Promise<void>
    getHeaders(): Record<string, string>
  }
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

async function gitlabModel() {
  const { createGitLab } = await import("gitlab-ai-provider")
  return createGitLab().chat("duo-chat-sonnet-4-6") as unknown as GitLabRuntimeModel
}

describe("patched auth dependencies", () => {
  test("Poe expired credentials direct users to the SlopCode login command", async () => {
    const hooks = await (PoeAuthPlugin as unknown as Plugin)({} as never)
    const error = await hooks.auth!.loader!(
      async () => ({ type: "oauth", access: "expired", refresh: "expired", expires: 0 }),
      {} as never,
    ).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error("Poe loader did not reject expired credentials")
    expect(error.message).toContain("slopcode providers login")
    expect(error.message).not.toContain("opencode providers login")
  })

  test("GitLab backfills normalized PAT metadata from legacy auth storage", async () => {
    await using tmp = await tmpdir()
    const previous = process.env.XDG_DATA_HOME
    const legacy = path.join(tmp.path, "opencode", "auth.json")
    const current = path.join(tmp.path, "slopcode", "auth.json")
    const other = { type: "api", key: "other-key", metadata: { account: "other-account" } } as const
    const gitlab = {
      type: "api",
      key: "glpat-test",
      metadata: { instanceUrl: "https://gitlab.example.com/groups/test/" },
    } as const

    try {
      process.env.XDG_DATA_HOME = tmp.path
      await fs.mkdir(path.dirname(legacy), { recursive: true })
      await Bun.write(legacy, JSON.stringify({ gitlab, other }, null, 2))
      expect(await Bun.file(current).exists()).toBe(false)

      const hooks = await (gitlabAuthPlugin as unknown as Plugin)({} as never)
      const loaded = await hooks.auth!.loader!(async () => gitlab, {} as never)

      expect(loaded).toEqual({ apiKey: "glpat-test", instanceUrl: "https://gitlab.example.com" })
      expect(await Bun.file(current).json()).toEqual({
        gitlab: {
          ...gitlab,
          metadata: { instanceUrl: "https://gitlab.example.com" },
        },
        other,
      })
    } finally {
      if (previous === undefined) delete process.env.XDG_DATA_HOME
      else process.env.XDG_DATA_HOME = previous
    }
  })

  test("GitLab provider loads a legacy API key into runtime headers", async () => {
    await using tmp = await tmpdir()
    const xdg = process.env.XDG_DATA_HOME
    const token = process.env.GITLAB_TOKEN
    const instance = process.env.GITLAB_INSTANCE_URL
    const legacy = path.join(tmp.path, "opencode", "auth.json")
    const current = path.join(tmp.path, "slopcode", "auth.json")

    try {
      process.env.XDG_DATA_HOME = tmp.path
      delete process.env.GITLAB_TOKEN
      delete process.env.GITLAB_INSTANCE_URL
      await fs.mkdir(path.dirname(legacy), { recursive: true })
      await Bun.write(legacy, JSON.stringify({ gitlab: { type: "api", key: "legacy-provider-key" } }, null, 2))
      expect(await Bun.file(current).exists()).toBe(false)

      const model = await gitlabModel()
      await model.config.ensureApiKey()

      expect(model.config.getHeaders().Authorization).toBe("Bearer legacy-provider-key")
    } finally {
      restore("XDG_DATA_HOME", xdg)
      restore("GITLAB_TOKEN", token)
      restore("GITLAB_INSTANCE_URL", instance)
    }
  })

  test("GitLab provider missing-key errors use the SlopCode login command", async () => {
    await using tmp = await tmpdir()
    const xdg = process.env.XDG_DATA_HOME
    const token = process.env.GITLAB_TOKEN
    const instance = process.env.GITLAB_INSTANCE_URL

    try {
      process.env.XDG_DATA_HOME = tmp.path
      delete process.env.GITLAB_TOKEN
      delete process.env.GITLAB_INSTANCE_URL

      const model = await gitlabModel()
      await model.config.ensureApiKey()
      const error = (() => {
        try {
          model.config.getHeaders()
        } catch (error) {
          return error
        }
      })()

      expect(error).toBeInstanceOf(Error)
      if (!(error instanceof Error)) throw new Error("GitLab provider did not reject missing credentials")
      expect(error.message).toContain("slopcode auth login gitlab")
      expect(error.message).not.toContain("opencode auth login gitlab")
    } finally {
      restore("XDG_DATA_HOME", xdg)
      restore("GITLAB_TOKEN", token)
      restore("GITLAB_INSTANCE_URL", instance)
    }
  })
})
