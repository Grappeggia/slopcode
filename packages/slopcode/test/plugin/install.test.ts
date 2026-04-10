import { describe, expect, test } from "bun:test"
import * as fs from "fs/promises"
import path from "path"
import { patchPluginConfig, readPluginManifest } from "../../src/plugin/install"
import { tmpdir } from "../fixture/fixture"

describe("plugin.install", () => {
  test("detects server plugins from package main", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const mod = path.join(dir, "plugin")
        await fs.mkdir(mod, { recursive: true })
        await Bun.write(
          path.join(mod, "package.json"),
          JSON.stringify({
            name: "demo-plugin",
            main: "./dist/index.js",
          }),
        )
        return mod
      },
    })

    const result = await readPluginManifest(tmp.extra)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.targets).toEqual([{ kind: "server" }])
  })

  test("rejects packages without a server entrypoint", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const mod = path.join(dir, "plugin")
        await fs.mkdir(mod, { recursive: true })
        await Bun.write(
          path.join(mod, "package.json"),
          JSON.stringify({
            name: "demo-plugin",
            exports: {
              "./tui": "./dist/tui.js",
            },
          }),
        )
        return mod
      },
    })

    const result = await readPluginManifest(tmp.extra)
    expect(result).toEqual({
      ok: false,
      code: "manifest_no_targets",
      file: path.join(tmp.extra, "package.json"),
    })
  })

  test("writes local plugin config into worktree config dir", async () => {
    await using tmp = await tmpdir({ git: true })
    const dir = path.join(tmp.path, "src")
    await fs.mkdir(dir, { recursive: true })

    const result = await patchPluginConfig({
      spec: "demo-plugin@1.2.3",
      targets: [{ kind: "server" }],
      vcs: "git",
      worktree: tmp.path,
      directory: dir,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const json = JSON.parse(await Bun.file(result.items[0]!.file).text())
    expect(json.plugin).toEqual(["demo-plugin@1.2.3"])
  })

  test("force replaces duplicate plugin versions", async () => {
    await using tmp = await tmpdir({ git: true })
    const cfg = path.join(tmp.path, ".slopcode", "slopcode.json")
    await Bun.write(
      cfg,
      JSON.stringify(
        {
          plugin: ["demo-plugin@1.0.0", "other-plugin@1.0.0", "demo-plugin@2.0.0"],
        },
        null,
        2,
      ),
    )

    const result = await patchPluginConfig({
      spec: "demo-plugin@3.0.0",
      targets: [{ kind: "server" }],
      force: true,
      vcs: "git",
      worktree: tmp.path,
      directory: tmp.path,
    })

    expect(result.ok).toBe(true)
    const json = JSON.parse(await Bun.file(cfg).text())
    expect(json.plugin).toEqual(["demo-plugin@3.0.0", "other-plugin@1.0.0"])
  })
})
