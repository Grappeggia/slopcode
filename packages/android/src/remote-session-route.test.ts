import { describe, expect, test } from "bun:test"

const app = await Bun.file(new URL("./index-app.tsx", import.meta.url)).text()

describe("remote-session recovery routes", () => {
  test("renders stale-link recovery on both SSH routes", () => {
    const ssh = app.match(/if \(shell\.ssh\) \{([\s\S]*?)\n  const workspace/)?.[1]

    expect(ssh).toBeDefined()
    expect(ssh?.match(/<RemoteSessionNotice message=\{remoteSessionError\(\)\} \/>/g)).toHaveLength(2)
  })
})
