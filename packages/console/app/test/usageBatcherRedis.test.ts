import { afterAll, beforeAll, expect, test } from "bun:test"
import { ACK_USAGE, CLAIM_USAGE, incrementUsage } from "../src/routes/zen/util/usageBatcher"

let container = ""

async function run(args: string[]) {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  const output = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const code = await proc.exited
  const [stdout, stderr] = await output
  if (code !== 0) throw new Error(stderr.trim() || `${args.join(" ")} failed with exit code ${code}`)
  return stdout.trim()
}

async function command(args: unknown[]) {
  return JSON.parse(await run(["docker", "exec", container, "redis-cli", "--json", ...args.map(String)]))
}

const redis = {
  eval<T>(script: string, keys: string[], args: unknown[]) {
    return command(["EVAL", script, keys.length, ...keys, ...args]) as Promise<T>
  },
}

async function ready(attempts = 40): Promise<void> {
  const pong = await run(["docker", "exec", container, "redis-cli", "PING"]).catch(() => "")
  if (pong === "PONG") return
  if (attempts === 0) throw new Error("Redis test container did not become ready")
  await Bun.sleep(100)
  return ready(attempts - 1)
}

beforeAll(async () => {
  container = `slopcode-console-redis-${crypto.randomUUID()}`
  await run(["docker", "run", "--rm", "-d", "--name", container, "redis:7.4.2-alpine"])
  await ready()
})

afterAll(async () => {
  if (container) await run(["docker", "rm", "-f", container])
})

test("runs independent multi-user claims and old split writes against Redis Lua", async () => {
  const workspace = "usage:wrk:shared"
  const userA = "usage:usr:shared:a"
  const userB = "usage:usr:shared:b"
  const workspaceQueue = "usage:claims:wrk:shared:queue"
  const workspaceData = "usage:claims:wrk:shared:data"
  const aQueue = "usage:claims:usr:shared:a:queue"
  const aData = "usage:claims:usr:shared:a:data"
  const bQueue = "usage:claims:usr:shared:b:queue"
  const bData = "usage:claims:usr:shared:b:data"

  expect(await incrementUsage(redis, workspace, userA, 30, 10)).toEqual({ workspaceCost: 30, userCost: 10 })
  expect(await incrementUsage(redis, workspace, userB, 40, 20)).toEqual({ workspaceCost: 70, userCost: 20 })
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:one"],
    ),
  ).toEqual([1, "workspace:one", "70"])
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:other"],
    ),
  ).toEqual([1, "workspace:one", "70"])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userA, aQueue, aData], ["user:a"])).toEqual([
    1,
    "user:a",
    "10",
  ])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userB, bQueue, bData], ["user:b"])).toEqual([
    1,
    "user:b",
    "20",
  ])
  expect(await command(["TTL", workspace])).toBe(-1)
  expect(await command(["TTL", workspaceQueue])).toBe(-1)
  expect(await command(["TTL", workspaceData])).toBe(-1)
  expect(await redis.eval<number>(ACK_USAGE, [workspaceQueue, workspaceData], ["workspace:one"])).toBe(1)
  expect(await redis.eval<number>(ACK_USAGE, [workspaceQueue, workspaceData], ["workspace:one"])).toBe(0)
  expect(await redis.eval<number>(ACK_USAGE, [aQueue, aData], ["user:a"])).toBe(1)
  expect(await redis.eval<number>(ACK_USAGE, [bQueue, bData], ["user:b"])).toBe(1)
  expect(await command(["TTL", workspaceQueue])).toBe(-2)
  expect(await command(["TTL", workspaceData])).toBe(-2)

  await command(["INCRBY", workspace, 50])
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:split"],
    ),
  ).toEqual([1, "workspace:split", "50"])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userA, aQueue, aData], ["user:empty"])).toEqual([
    0,
    "",
    "0",
  ])
  await command(["INCRBY", userA, 20])
  expect(await redis.eval<number>(ACK_USAGE, [workspaceQueue, workspaceData], ["workspace:split"])).toBe(1)
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:empty"],
    ),
  ).toEqual([0, "", "0"])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userA, aQueue, aData], ["user:split"])).toEqual([
    1,
    "user:split",
    "20",
  ])
})
