import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import type { Prompt } from "@/context/prompt"

let createPromptSubmit: typeof import("./submit").createPromptSubmit
let promptQueue: typeof import("./queue").promptQueue
let promptQueueKey: typeof import("./queue").promptQueueKey

const ROOT = "/repo/main"

const createdClients: string[] = []
const createdSessions: string[] = []
const sentPrompts: Array<{ directory: string; sessionID: string; messageID: string; text: string }> = []
const sentShell: string[] = []
const syncedDirectories: string[] = []
const historyTargets: Array<{ dir?: string; id?: string } | undefined> = []
const stores = new Map<string, Store>()

let paramsValue: { id?: string } = {}
let selected = "/repo/worktree-a"
let promptValue: Prompt = [{ type: "text", content: "ls", start: 0, end: 2 }]

type Store = {
  command: { name: string }[]
  config: { queue_mode?: "serial" | "injection" }
  message: Record<string, any[] | undefined>
  session_status: Record<string, { type: string } | undefined>
  todo: Record<string, any[] | undefined>
}

const storeFor = (directory: string) => {
  const match = stores.get(directory)
  if (match) return match
  const next: Store = {
    command: [],
    config: {},
    message: {},
    session_status: {},
    todo: {},
  }
  stores.set(directory, next)
  return next
}

const setPath = (target: Record<string, any>, path: (string | number)[], value: unknown) => {
  const last = path[path.length - 1]
  if (last === undefined) return
  const parent = path.slice(0, -1).reduce((acc, part, index) => {
    const next = path[index + 1]
    acc[part] ??= typeof next === "number" ? [] : {}
    return acc[part]
  }, target)
  parent[last] = value
}

const messages = (directory: string, sessionID: string) => {
  const store = storeFor(directory)
  store.message[sessionID] ??= []
  return store.message[sessionID]!
}

const complete = (directory: string, sessionID: string, messageID: string) => {
  const list = messages(directory, sessionID)
  const index = list.findIndex((item) => item.id === messageID)
  const next = {
    id: `assistant-${messageID}`,
    role: "assistant",
    sessionID,
    parentID: messageID,
    finish: "stop",
    time: {
      created: Date.now(),
      completed: Date.now(),
    },
  }
  if (index === -1) {
    list.push(next)
    return
  }
  const stop = list.findIndex((item, itemIndex) => itemIndex > index && item.role === "user")
  const insert = stop === -1 ? list.length : stop
  list.splice(insert, 0, next)
}

const eventually = async (check: () => boolean | Promise<boolean>, timeout = 2000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(10)
  }
  throw new Error("condition not met")
}

const clientFor = (directory: string) => {
  createdClients.push(directory)
  return {
    session: {
      create: async () => {
        createdSessions.push(directory)
        return { data: { id: `session-${createdSessions.length}` } }
      },
      shell: async () => {
        sentShell.push(directory)
        return { data: undefined }
      },
      prompt: async () => ({ data: undefined }),
      promptAsync: async (input: any) => {
        sentPrompts.push({
          directory,
          sessionID: input.sessionID,
          messageID: input.messageID,
          text: input.parts.find((part: { type: string }) => part.type === "text")?.text ?? "",
        })
        return { data: undefined }
      },
      command: async () => ({ data: undefined }),
      abort: async () => ({ data: undefined }),
    },
    worktree: {
      create: async () => ({ data: { directory: `${directory}/new` } }),
    },
  }
}

beforeAll(async () => {
  const rootClient = clientFor(ROOT)

  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => paramsValue,
  }))

  mock.module("@slopcode-ai/sdk/v2/client", () => ({
    createSlopcodeClient: (input: { directory: string }) => {
      createdClients.push(input.directory)
      return clientFor(input.directory)
    },
  }))

  mock.module("@slopcode-ai/ui/toast", () => ({
    showToast: () => 0,
  }))

  mock.module("@slopcode-ai/util/encode", () => ({
    base64Encode: (value: string) => value,
  }))

  mock.module("@/context/local", () => ({
    useLocal: () => ({
      model: {
        current: () => ({ id: "model", provider: { id: "provider" } }),
        variant: { current: () => undefined },
      },
      agent: {
        current: () => ({ name: "agent" }),
      },
    }),
  }))

  mock.module("@/context/prompt", () => ({
    usePrompt: () => ({
      current: () => promptValue,
      reset: () => undefined,
      set: () => undefined,
      context: {
        add: () => undefined,
        remove: () => undefined,
        items: () => [],
      },
    }),
  }))

  mock.module("@/context/layout", () => ({
    useLayout: () => ({
      handoff: {
        setTabs: () => undefined,
      },
    }),
  }))

  mock.module("@/context/sdk", () => ({
    useSDK: () => {
      const sdk = {
        directory: ROOT,
        client: rootClient,
        url: "http://localhost:4096",
        createClient(opts: any) {
          return clientFor(opts.directory)
        },
      }
      return sdk
    },
  }))

  mock.module("@/context/sync", () => ({
    useSync: () => ({
      data: storeFor(ROOT),
      session: {
        optimistic: {
          add(input: { directory?: string; sessionID: string; message: any }) {
            messages(input.directory ?? ROOT, input.sessionID).push(input.message)
          },
          remove(input: { directory?: string; sessionID: string; messageID: string }) {
            const list = messages(input.directory ?? ROOT, input.sessionID)
            const index = list.findIndex((item) => item.id === input.messageID)
            if (index !== -1) list.splice(index, 1)
          },
        },
      },
      set(...args: any[]) {
        setPath(storeFor(ROOT) as unknown as Record<string, any>, args.slice(0, -1), args.at(-1))
      },
    }),
  }))

  mock.module("@/context/global-sync", () => ({
    useGlobalSync: () => ({
      child: (directory: string) => {
        syncedDirectories.push(directory)
        const store = storeFor(directory)
        return [
          store,
          (...args: any[]) => setPath(store as unknown as Record<string, any>, args.slice(0, -1), args.at(-1)),
        ] as const
      },
      todo: {
        set(sessionID: string, value: any[]) {
          storeFor(ROOT).todo[sessionID] = value
        },
      },
    }),
  }))

  mock.module("@/context/platform", () => ({
    usePlatform: () => ({
      fetch: fetch,
    }),
  }))

  mock.module("@/context/language", () => ({
    useLanguage: () => ({
      t: (key: string) => key,
    }),
  }))

  const mod = await import("./submit")
  createPromptSubmit = mod.createPromptSubmit

  const queue = await import("./queue")
  promptQueue = queue.promptQueue
  promptQueueKey = queue.promptQueueKey
})

beforeEach(() => {
  createdClients.length = 0
  createdSessions.length = 0
  sentPrompts.length = 0
  sentShell.length = 0
  syncedDirectories.length = 0
  historyTargets.length = 0
  stores.clear()
  paramsValue = {}
  selected = "/repo/worktree-a"
  promptValue = [{ type: "text", content: "ls", start: 0, end: 2 }]

  for (const directory of [ROOT, "/repo/worktree-a", "/repo/worktree-b"]) {
    for (const sessionID of ["session-1", "session-2"]) {
      promptQueue.clear(promptQueueKey(directory, sessionID), { active: true })
    }
  }
})

describe("prompt submit worktree selection", () => {
  test("reads the latest worktree accessor value per submit", async () => {
    const submit = createPromptSubmit({
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: (_, __, target) => {
        historyTargets.push(target)
      },
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)
    selected = "/repo/worktree-b"
    await submit.handleSubmit(event)

    expect(createdClients).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(createdSessions).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(sentShell).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(syncedDirectories).toEqual(["/repo/worktree-a", "/repo/worktree-a", "/repo/worktree-b", "/repo/worktree-b"])
    expect(historyTargets).toEqual([
      { dir: "/repo/worktree-a", id: "session-1" },
      { dir: "/repo/worktree-b", id: "session-2" },
    ])
  })
})

describe("prompt submit serial queue", () => {
  test("serial sends one queued prompt at a time after the previous turn finishes", async () => {
    paramsValue = { id: "session-1" }
    storeFor(ROOT).config.queue_mode = "serial"
    storeFor(ROOT).session_status["session-1"] = { type: "idle" }

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    promptValue = [{ type: "text", content: "first", start: 0, end: 5 }]
    await submit.handleSubmit(event)
    await eventually(() => sentPrompts.length === 1)

    promptValue = [{ type: "text", content: "second", start: 0, end: 6 }]
    await submit.handleSubmit(event)
    await Bun.sleep(50)

    expect(sentPrompts).toHaveLength(1)
    expect(sentPrompts[0].text).toBe("first")

    complete(ROOT, "session-1", sentPrompts[0].messageID)

    await eventually(() => sentPrompts.length === 2)
    expect(sentPrompts[1].text).toBe("second")

    complete(ROOT, "session-1", sentPrompts[1].messageID)
    await Bun.sleep(50)
  })

  test("stores queue metadata for rendering while prompts are serialized", async () => {
    paramsValue = { id: "session-1" }
    storeFor(ROOT).config.queue_mode = "serial"
    storeFor(ROOT).session_status["session-1"] = { type: "idle" }

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    promptValue = [{ type: "text", content: "first prompt", start: 0, end: 12 }]
    await submit.handleSubmit(event)
    await eventually(() => sentPrompts.length === 1)

    promptValue = [{ type: "text", content: "second prompt waiting in queue", start: 0, end: 28 }]
    await submit.handleSubmit(event)

    await eventually(() => promptQueue.snapshot(promptQueueKey(ROOT, "session-1")).queue.length === 1)

    const snapshot = promptQueue.snapshot(promptQueueKey(ROOT, "session-1"))
    expect(snapshot.active?.summary).toBe("first prompt")
    expect(snapshot.queue[0]?.summary).toBe("second prompt waiting in queue")

    complete(ROOT, "session-1", sentPrompts[0].messageID)
    await eventually(
      () =>
        promptQueue.snapshot(promptQueueKey(ROOT, "session-1")).active?.summary === "second prompt waiting in queue",
    )
  })

  test("clears queued prompt metadata without dropping the active item", async () => {
    paramsValue = { id: "session-1" }
    storeFor(ROOT).config.queue_mode = "serial"
    storeFor(ROOT).session_status["session-1"] = { type: "idle" }

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    promptValue = [{ type: "text", content: "active prompt", start: 0, end: 13 }]
    await submit.handleSubmit(event)
    await eventually(() => sentPrompts.length === 1)

    promptValue = [{ type: "text", content: "queued prompt", start: 0, end: 12 }]
    await submit.handleSubmit(event)
    await eventually(() => promptQueue.snapshot(promptQueueKey(ROOT, "session-1")).queue.length === 1)

    promptQueue.clear(promptQueueKey(ROOT, "session-1"))

    const snapshot = promptQueue.snapshot(promptQueueKey(ROOT, "session-1"))
    expect(snapshot.active?.summary).toBe("active prompt")
    expect(snapshot.queue).toHaveLength(0)
  })

  test("removes one queued prompt metadata item without affecting the rest", async () => {
    paramsValue = { id: "session-1" }
    storeFor(ROOT).config.queue_mode = "serial"
    storeFor(ROOT).session_status["session-1"] = { type: "idle" }

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    promptValue = [{ type: "text", content: "first active", start: 0, end: 12 }]
    await submit.handleSubmit(event)
    await eventually(() => sentPrompts.length === 1)

    promptValue = [{ type: "text", content: "second queued", start: 0, end: 13 }]
    await submit.handleSubmit(event)
    promptValue = [{ type: "text", content: "third queued", start: 0, end: 12 }]
    await submit.handleSubmit(event)

    await eventually(() => promptQueue.snapshot(promptQueueKey(ROOT, "session-1")).queue.length === 2)

    const before = promptQueue.snapshot(promptQueueKey(ROOT, "session-1"))
    promptQueue.remove(promptQueueKey(ROOT, "session-1"), (item) => item.summary === "second queued")
    const after = promptQueue.snapshot(promptQueueKey(ROOT, "session-1"))

    expect(before.queue.map((item) => item.summary)).toEqual(["second queued", "third queued"])
    expect(after.active?.summary).toBe("first active")
    expect(after.queue.map((item) => item.summary)).toEqual(["third queued"])
  })

  test("injection keeps follow-up prompt dispatch immediate", async () => {
    paramsValue = { id: "session-1" }
    storeFor(ROOT).config.queue_mode = "injection"
    storeFor(ROOT).session_status["session-1"] = { type: "idle" }

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    promptValue = [{ type: "text", content: "first", start: 0, end: 5 }]
    await submit.handleSubmit(event)
    promptValue = [{ type: "text", content: "second", start: 0, end: 6 }]
    await submit.handleSubmit(event)

    await eventually(() => sentPrompts.length === 2)
    expect(sentPrompts.map((item) => item.text)).toEqual(["first", "second"])
  })
})
