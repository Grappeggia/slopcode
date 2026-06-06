import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionPrompt } from "../../src/session/prompt"

type Rule = {
  permission: string
  pattern: string
  action: string
}

let createdPermission: Rule[] = []
let promptTools: Record<string, boolean> | undefined
let promptVariant: string | undefined

const ctx = {
  sessionID: "session",
  messageID: "message",
  agent: "primary",
  abort: AbortSignal.abort(),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

async function provide(permission: Record<string, "allow" | "ask" | "deny">, fn: () => Promise<void>) {
  await using tmp = await tmpdir({
    config: {
      agent: {
        helper: {
          mode: "subagent",
          description: "helper agent",
          permission,
        },
      },
    },
  })
  await Instance.provide({ directory: tmp.path, fn })
}

beforeEach(() => {
  createdPermission = []
  promptTools = undefined
  promptVariant = undefined
  spyOn(Session, "get").mockImplementation((async () => undefined) as any)
  spyOn(Session, "create").mockImplementation((async (input: { permission: Rule[] }) => {
    createdPermission = input.permission
    return { id: "subtask-session" }
  }) as any)
  spyOn(MessageV2, "get").mockImplementation((async () => ({
    info: {
      role: "assistant",
      modelID: "model-id",
      providerID: "provider-id",
      variant: "xhigh",
    },
    parts: [],
  })) as any)
  spyOn(SessionPrompt, "cancel").mockImplementation((async () => {}) as any)
  spyOn(SessionPrompt, "resolvePromptParts").mockImplementation((async (prompt: string) => [
    { type: "text", text: prompt },
  ]) as any)
  spyOn(SessionPrompt, "prompt").mockImplementation((async (input: { tools: Record<string, boolean>; variant?: string }) => {
    promptTools = input.tools
    promptVariant = input.variant
    return { parts: [{ type: "text", text: "done" }] }
  }) as any)
})

afterEach(() => {
  mock.restore()
})

describe("tool.task todo permissions", () => {
  test("keeps todo tools enabled when the subagent can use them", async () => {
    await provide({ todowrite: "allow", todoread: "allow" }, async () => {
      const { TaskTool } = await import("../../src/tool/task")
      const task = await TaskTool.init()

      await task.execute({ description: "helper task", prompt: "ship it", subagent_type: "helper" }, ctx)

      expect(createdPermission.some((rule) => rule.permission === "todowrite" && rule.action === "deny")).toBe(false)
      expect(createdPermission.some((rule) => rule.permission === "todoread" && rule.action === "deny")).toBe(false)
      expect(promptTools?.todowrite).toBeUndefined()
      expect(promptTools?.todoread).toBeUndefined()
    })
  })

  test("preserves the parent model variant for delegated tasks", async () => {
    await provide({}, async () => {
      const { TaskTool } = await import("../../src/tool/task")
      const task = await TaskTool.init()

      await task.execute({ description: "helper task", prompt: "ship it", subagent_type: "helper" }, ctx)

      expect(promptVariant).toBe("xhigh")
    })
  })

  test("keeps todo tools denied by default for subagents without permission", async () => {
    await provide({}, async () => {
      const { TaskTool } = await import("../../src/tool/task")
      const task = await TaskTool.init()

      await task.execute({ description: "helper task", prompt: "ship it", subagent_type: "helper" }, ctx)

      expect(createdPermission.some((rule) => rule.permission === "todowrite" && rule.action === "deny")).toBe(true)
      expect(createdPermission.some((rule) => rule.permission === "todoread" && rule.action === "deny")).toBe(true)
      expect(promptTools?.todowrite).toBe(false)
      expect(promptTools?.todoread).toBe(false)
    })
  })
})
