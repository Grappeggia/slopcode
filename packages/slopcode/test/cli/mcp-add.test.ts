import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"

const pkg = path.resolve(import.meta.dir, "../..")

async function run(home: string, args: string[]) {
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local", "share"),
    XDG_STATE_HOME: path.join(home, ".local", "state"),
    XDG_CACHE_HOME: path.join(home, ".cache"),
    SLOPCODE_DISABLE_TELEMETRY: "1",
    SLOPCODE_DISABLE_UPDATE_CHECK: "1",
    SLOPCODE_DISABLE_AUTO_UPDATE: "1",
    SLOPCODE_CONFIG_DIR: undefined,
  }
  const proc = Bun.spawn([process.execPath, "run", "--conditions=browser", "./src/index.ts", ...args], {
    cwd: pkg,
    stdout: "pipe",
    stderr: "pipe",
    env,
  })
  return {
    code: await proc.exited,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text(),
  }
}

async function config(home: string) {
  return await Bun.file(path.join(home, ".config", "slopcode", "slopcode.json")).json()
}

describe("mcp add", () => {
  test("adds a remote server with HTTP headers", async () => {
    await using tmp = await tmpdir()
    const result = await run(tmp.path, [
      "mcp",
      "add",
      "github",
      "--url",
      "https://example.com/mcp",
      "--header",
      "Authorization=Bearer {env:GITHUB_TOKEN}",
      "--header",
      "X-Option=one=two",
    ])
    expect(result.code).toBe(0)
    expect((await config(tmp.path)).mcp.github).toEqual({
      type: "remote",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer {env:GITHUB_TOKEN}",
        "X-Option": "one=two",
      },
    })
  })

  test("adds a local server while preserving argv and environment values", async () => {
    await using tmp = await tmpdir()
    const result = await run(tmp.path, [
      "mcp",
      "add",
      "local",
      "--env",
      "API_KEY=secret",
      "--env",
      "VALUE=one=two",
      "--",
      "npx",
      "-y",
      "@example/server",
      "--label",
      "two words",
    ])
    expect(result.code).toBe(0)
    expect((await config(tmp.path)).mcp.local).toEqual({
      type: "local",
      command: ["npx", "-y", "@example/server", "--label", "two words"],
      environment: {
        API_KEY: "secret",
        VALUE: "one=two",
      },
    })
  })
})
