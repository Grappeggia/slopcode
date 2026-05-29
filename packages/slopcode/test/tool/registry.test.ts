import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"
import { Config } from "../../src/config/config"
import { Installation } from "../../src/installation"
import { Filesystem } from "../../src/util/filesystem"

const originalConfigDir = process.env.SLOPCODE_CONFIG_DIR

async function markDependenciesInstalled(dir: string) {
  await fs.mkdir(path.join(dir, "node_modules", "@slopcode-ai", "plugin"), { recursive: true })
  await Filesystem.writeJson(path.join(dir, "node_modules", "@slopcode-ai", "plugin", "package.json"), {
    name: "@slopcode-ai/plugin",
  })
  await Filesystem.writeJson(path.join(dir, "package.json"), {
    dependencies: {
      "@slopcode-ai/plugin": `npm:@slopcode-ai/plugin@${Installation.VERSION}`,
    },
  })
}

describe("tool.registry", () => {
  afterEach(() => {
    Config.global.reset()
    if (originalConfigDir === undefined) delete process.env.SLOPCODE_CONFIG_DIR
    else process.env.SLOPCODE_CONFIG_DIR = originalConfigDir
  })

  test("does not import tools from project .slopcode directories", async () => {
    await using tmp = await tmpdir<string>({
      init: async (dir) => {
        const slopcodeDir = path.join(dir, ".slopcode")
        await fs.mkdir(slopcodeDir, { recursive: true })

        const toolsDir = path.join(slopcodeDir, "tools")
        await fs.mkdir(toolsDir, { recursive: true })

        const sideEffect = path.join(dir, "tool-imported.txt")
        await Bun.write(
          path.join(toolsDir, "project_disallowed_security_probe.ts"),
          [
            `await Bun.write(${JSON.stringify(sideEffect)}, "loaded")`,
            "export default {",
            "  description: 'project tool that should not load',",
            "  args: {},",
            "  execute: async () => {",
            "    return 'project tool loaded'",
            "  },",
            "}",
            "",
          ].join("\n"),
        )
        return sideEffect
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).not.toContain("project_disallowed_security_probe")
      },
    })

    expect(await Filesystem.exists(tmp.extra)).toBe(false)
  })

  test("loads tools from trusted SLOPCODE_CONFIG_DIR", async () => {
    await using tmp = await tmpdir<string>({
      init: async (dir) => {
        const configDir = path.join(dir, "trusted-config")
        await fs.mkdir(configDir, { recursive: true })
        await markDependenciesInstalled(configDir)

        const toolsDir = path.join(configDir, "tools")
        await fs.mkdir(toolsDir, { recursive: true })

        await Bun.write(
          path.join(toolsDir, "trusted_security_probe.ts"),
          [
            "export default {",
            "  description: 'trusted config tool',",
            "  args: {},",
            "  execute: async () => {",
            "    return 'trusted tool loaded'",
            "  },",
            "}",
            "",
          ].join("\n"),
        )
        return configDir
      },
    })

    process.env.SLOPCODE_CONFIG_DIR = tmp.extra

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("trusted_security_probe")
      },
    })
  })
})
