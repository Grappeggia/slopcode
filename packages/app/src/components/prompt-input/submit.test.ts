import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import type { Prompt } from "@/context/prompt"
import { Worktree } from "@/utils/worktree"
import { ServerScope } from "@/utils/server-scope"

let createPromptSubmit: typeof import("./submit").createPromptSubmit
let sendFollowupDraft: typeof import("./submit").sendFollowupDraft

const createdClients: string[] = []
const createdSessions: string[] = []
const enabledAutoAccept: Array<{ sessionID: string; directory: string }> = []
const optimistic: Array<{
  directory?: string
  sessionID?: string
  message: {
    agent: string
    model: { providerID: string; modelID: string }
    variant?: string
  }
}> = []
const optimisticSeeded: boolean[] = []
const storedSessions: Record<string, Array<{ id: string; title?: string }>> = {}
const promoted: Array<{ directory: string; sessionID: string }> = []
const draftPromotions: string[] = []
const deletedSessions: string[] = []
const removedOptimistic: Array<{ directory: string; sessionID: string; messageID: string }> = []
let deleteFails = false
const sentShell: string[] = []
const sentCommands: string[] = []
const syncedDirectories: string[] = []
const submissions = new Map<string, unknown>()
const sentPrompts: Array<{ sessionID?: string; messageID?: string; parts?: unknown }> = []
type PromptResult = { data?: unknown; error?: unknown; response?: Response }
let promptResults: Array<PromptResult | Promise<PromptResult>> = []
let createResults: Array<Promise<{ data?: Record<string, unknown> }> | { data?: Record<string, unknown> }> = []
const replacements: Array<{ value: unknown; scope: unknown }> = []
const commentReplacements: Array<{ value: unknown; scope: unknown }> = []
let promptContext: Array<Record<string, unknown>> = []
let promptCursor = 2
let promptMode: "normal" | "shell" = "normal"
let commentsValue: Array<Record<string, unknown>> = []
let submitCallbacks = 0
let commands: Array<{ name: string }> = []

let params: { id?: string } = {}
let search: { draftId?: string } = {}
let selected = "/repo/worktree-a"
let variant: string | undefined

let promptValue: Prompt = [{ type: "text", content: "ls", start: 0, end: 2 }]

const clientFor = (directory: string) => {
  createdClients.push(directory)
  return {
    session: {
      create: async () => {
        createdSessions.push(directory)
        const result = createResults.shift()
        if (result) return await result
        return {
          data: {
            id: `session-${createdSessions.length}`,
            title: `New session ${createdSessions.length}`,
          },
        }
      },
      shell: async () => {
        sentShell.push(directory)
        return { data: undefined }
      },
      prompt: async () => ({ data: undefined }),
      promptAsync: async (request: { sessionID?: string; messageID?: string; parts?: unknown }) => {
        sentPrompts.push(request)
        return await (promptResults.shift() ?? { data: undefined })
      },
      command: async (input: { command: string }) => {
        sentCommands.push(input.command)
        return { data: undefined }
      },
      delete: async (input: { sessionID: string }) => {
        deletedSessions.push(input.sessionID)
        if (deleteFails) throw new Error("delete failed")
        return { data: true }
      },
      abort: async () => ({ data: undefined }),
    },
    worktree: {
      create: async () => ({ data: { directory: `${directory}/new` } }),
    },
  }
}

beforeAll(async () => {
  const rootClient = clientFor("/repo/main")

  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => params,
    useLocation: () => ({}),
    useSearchParams: () => [search, () => undefined],
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

  mock.module("@slopcode-ai/core/util/encode", () => ({
    base64Encode: (value: string) => value,
  }))

  mock.module("@/context/local", () => ({
    useLocal: () => ({
      model: {
        current: () => ({ id: "model", provider: { id: "provider" } }),
        variant: { current: () => variant },
      },
      agent: {
        current: () => ({ name: "agent" }),
      },
      session: {
        promote(directory: string, sessionID: string) {
          promoted.push({ directory, sessionID })
        },
      },
    }),
  }))

  mock.module("@/context/permission", () => ({
    usePermission: () => ({
      enableAutoAccept(sessionID: string, directory: string) {
        enabledAutoAccept.push({ sessionID, directory })
      },
    }),
  }))

  mock.module("@/context/server", () => ({
    useServer: () => ({ key: "server-key" }),
  }))

  mock.module("@/context/tabs", () => ({
    draftSubmissionOwner: (server: string, draftID: string | undefined, directory: string) =>
      `${server}\n${draftID ? `draft:${draftID}` : `legacy:${directory}`}`,
    useTabs: () => ({
      promoteDraft: (draftID: string) => draftPromotions.push(draftID),
      get store() {
        return search.draftId
          ? [{ type: "draft", draftID: search.draftId, server: "server-key", directory: "/repo/main" }]
          : []
      },
      submission: {
        get: (owner: string) => submissions.get(owner),
        set: (owner: string, value: unknown) => {
          submissions.set(owner, value)
          return value
        },
        clear: (owner: string) => {
          const state = submissions.get(owner)
          if (state && typeof state === "object" && "dispose" in state && typeof state.dispose === "function") {
            const dispose = state.dispose
            state.dispose = undefined
            dispose()
          }
          return submissions.delete(owner)
        },
        release: (owner: string) => submissions.delete(owner),
        touch: () => undefined,
      },
    }),
  }))

  mock.module("@/context/prompt", () => ({
    DEFAULT_PROMPT: [{ type: "text", content: "", start: 0, end: 0 }],
    usePrompt: () => ({
      current: () => promptValue,
      cursor: () => promptCursor,
      mode: () => promptMode,
      snapshot: () => ({ prompt: promptValue, cursor: promptCursor, context: promptContext, mode: promptMode }),
      reset: () => undefined,
      set: () => undefined,
      replace: (value: unknown, scope: unknown) => replacements.push({ value, scope }),
      setMode: () => undefined,
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

  mock.module("@/context/comments", () => ({
    useComments: () => ({
      all: () => commentsValue,
      replace: (value: unknown, scope: unknown) => commentReplacements.push({ value, scope }),
      clear: () => undefined,
    }),
  }))

  mock.module("@/context/sdk", () => ({
    useSDK: () => {
      const sdk = {
        scope: "local",
        directory: "/repo/main",
        client: rootClient,
        url: "http://localhost:4096",
        createClient(opts: any) {
          return clientFor(opts.directory)
        },
      }
      return sdk
    },
  }))

  mock.module("@/context/server-sdk", () => ({
    useServerSDK: () => ({
      scope: "local",
      client: rootClient,
      createClient: (opts: { directory: string }) => clientFor(opts.directory),
    }),
  }))

  mock.module("@/context/sync", () => ({
    useSync: () => ({
      data: {
        get command() {
          return commands
        },
      },
      session: {
        optimistic: {
          add: (value: {
            directory?: string
            sessionID?: string
            message: { agent: string; model: { providerID: string; modelID: string; variant?: string } }
          }) => {
            optimistic.push(value)
            optimisticSeeded.push(
              !!value.directory &&
                !!value.sessionID &&
                !!storedSessions[value.directory]?.find((item) => item.id === value.sessionID)?.title,
            )
          },
          remove: () => undefined,
        },
      },
      set: () => undefined,
    }),
  }))

  mock.module("@/context/server-sync", () => ({
    useServerSync: () => ({
      optimistic: {
        remove: (directory: string, sessionID: string, messageID: string) =>
          removedOptimistic.push({ directory, sessionID, messageID }),
      },
      child: (directory: string) => {
        syncedDirectories.push(directory)
        storedSessions[directory] ??= []
        return [
          { session: storedSessions[directory] },
          (...args: unknown[]) => {
            if (args[0] !== "session") return
            const next = args[1]
            if (typeof next === "function") {
              storedSessions[directory] = next(storedSessions[directory]) as Array<{ id: string; title?: string }>
              return
            }
            if (Array.isArray(next)) {
              storedSessions[directory] = next as Array<{ id: string; title?: string }>
            }
          },
        ]
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
  sendFollowupDraft = mod.sendFollowupDraft
})

beforeEach(() => {
  createdClients.length = 0
  createdSessions.length = 0
  enabledAutoAccept.length = 0
  optimistic.length = 0
  optimisticSeeded.length = 0
  promoted.length = 0
  draftPromotions.length = 0
  deletedSessions.length = 0
  removedOptimistic.length = 0
  deleteFails = false
  params = {}
  search = {}
  sentShell.length = 0
  sentCommands.length = 0
  syncedDirectories.length = 0
  selected = "/repo/worktree-a"
  Worktree.clear(ServerScope.local, "/repo/worktree-a")
  Worktree.clear(ServerScope.local, "/repo/worktree-b")
  Worktree.clear(ServerScope.local, "/repo/main/new")
  variant = undefined
  promptValue = [{ type: "text", content: "ls", start: 0, end: 2 }]
  promptResults = []
  createResults = []
  sentPrompts.length = 0
  replacements.length = 0
  commentReplacements.length = 0
  promptContext = []
  promptCursor = 2
  promptMode = "normal"
  commentsValue = []
  submitCallbacks = 0
  commands = []
  for (const key of Object.keys(storedSessions)) delete storedSessions[key]
  submissions.clear()
})

const normalSubmit = () =>
  createPromptSubmit({
    info: () => undefined,
    imageAttachments: () => [],
    commentCount: () => 0,
    autoAccept: () => false,
    mode: () => promptMode,
    working: () => false,
    editor: () => undefined,
    queueScroll: () => undefined,
    promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
    addToHistory: () => undefined,
    resetHistoryNavigation: () => undefined,
    setMode: () => undefined,
    setPopover: () => undefined,
    newSessionWorktree: () => selected,
    onNewSessionWorktreeReset: () => undefined,
    onSubmit: () => submitCallbacks++,
  })

const invalidate = (owner: string) => {
  const state = submissions.get(owner)
  if (state && typeof state === "object" && "dispose" in state && typeof state.dispose === "function") {
    const dispose = state.dispose
    state.dispose = undefined
    dispose()
  }
  submissions.delete(owner)
}

describe("prompt submit worktree selection", () => {
  test("reads the latest worktree accessor value per submit", async () => {
    const submit = createPromptSubmit({
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => false,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
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
    expect(promoted).toEqual([
      { directory: "/repo/worktree-a", sessionID: "session-1" },
      { directory: "/repo/worktree-b", sessionID: "session-2" },
    ])
    expect(syncedDirectories).toEqual(["/repo/worktree-a", "/repo/worktree-a", "/repo/worktree-b", "/repo/worktree-b"])
  })

  test("applies auto-accept to newly created sessions", async () => {
    const submit = createPromptSubmit({
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => true,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)

    expect(enabledAutoAccept).toEqual([{ sessionID: "session-1", directory: "/repo/worktree-a" }])
  })

  test("includes the selected variant on optimistic prompts", async () => {
    params = { id: "session-1" }
    variant = "high"

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => false,
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

    await submit.handleSubmit(event)

    expect(optimistic).toHaveLength(1)
    expect(optimistic[0]).toMatchObject({
      message: {
        agent: "agent",
        model: { providerID: "provider", modelID: "model", variant: "high" },
      },
    })
  })

  test("seeds new sessions only after optimistic prompt admission", async () => {
    const submit = createPromptSubmit({
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => false,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)

    expect(storedSessions["/repo/worktree-a"]).toEqual([{ id: "session-1", title: "New session 1" }])
    expect(optimisticSeeded).toEqual([false])
  })
})

describe("followup prompt delivery", () => {
  const options: unknown[] = []
  const input = (result: { error: unknown; response: Response }) =>
    ({
      client: {
        session: {
          promptAsync: async (_: unknown, option: unknown) => {
            options.push(option)
            return result
          },
        },
      },
      serverSync: {
        child: () => [{}, () => undefined],
      },
      sync: {
        data: { command: [] },
        session: {
          optimistic: {
            add: () => undefined,
            remove: () => undefined,
          },
        },
      },
      draft: {
        sessionID: "session-delivery",
        sessionDirectory: "/repo/main",
        prompt: [{ type: "text", content: "hello", start: 0, end: 5 }],
        context: [],
        agent: "agent",
        model: { providerID: "provider", modelID: "model" },
      },
    }) as unknown as Parameters<typeof sendFollowupDraft>[0]

  test("rejects authoritative non-throwing SDK errors", async () => {
    options.length = 0
    const error = { data: { message: "invalid prompt" } }
    const promise = sendFollowupDraft(input({ error, response: new Response(null, { status: 400 }) }))

    await expect(promise).rejects.toMatchObject({ delivery: "rejected", status: 400 })
    expect(options).toEqual([{ throwOnError: false }])
  })

  test("classifies non-throwing 5xx SDK errors as ambiguous", async () => {
    const error = { data: { message: "unavailable" } }
    const promise = sendFollowupDraft(input({ error, response: new Response(null, { status: 503 }) }))

    await expect(promise).rejects.toMatchObject({ delivery: "ambiguous", status: 503 })
  })

  test("classifies worktree wait failures as not sent", async () => {
    options.length = 0
    const value = input({ error: undefined, response: new Response(null, { status: 204 }) })
    value.before = async () => {
      throw new Error("worktree failed")
    }

    await expect(sendFollowupDraft(value)).rejects.toMatchObject({ delivery: "not-sent" })
    expect(options).toEqual([])
  })
})

describe("new-session remount delivery", () => {
  const event = { preventDefault: () => undefined } as unknown as Event

  test("reuses the provisional session with a fresh ID after authoritative rejection", async () => {
    promptResults = [
      { error: { data: { message: "invalid" } }, response: new Response(null, { status: 400 }) },
      { data: undefined },
    ]

    await normalSubmit().handleSubmit(event)
    await normalSubmit().handleSubmit(event)

    expect(createdSessions).toEqual([selected])
    expect(sentPrompts).toHaveLength(2)
    expect(sentPrompts[1]?.messageID).not.toBe(sentPrompts[0]?.messageID)
    expect((sentPrompts[1]?.messageID ?? "") > (sentPrompts[0]?.messageID ?? "")).toBe(true)
  })

  test("replays the exact request and ID after ambiguous delivery", async () => {
    promptResults = [
      { error: { data: { message: "unavailable" } }, response: new Response(null, { status: 503 }) },
      { data: undefined },
    ]

    await normalSubmit().handleSubmit(event)
    promptValue = [{ type: "text", content: "edited after ambiguity", start: 0, end: 22 }]
    await normalSubmit().handleSubmit(event)

    expect(createdSessions).toEqual([selected])
    expect(sentPrompts).toHaveLength(2)
    expect(sentPrompts[1]).toEqual(sentPrompts[0])
  })

  test("does not reroute an ambiguous normal prompt when the command catalog changes", async () => {
    promptValue = [{ type: "text", content: "/name", start: 0, end: 5 }]
    promptResults = [
      { error: { data: { message: "unavailable" } }, response: new Response(null, { status: 503 }) },
      { data: undefined },
    ]

    await normalSubmit().handleSubmit(event)
    commands = [{ name: "name" }]
    await normalSubmit().handleSubmit(event)

    expect(sentCommands).toEqual([])
    expect(sentPrompts).toHaveLength(2)
    expect(sentPrompts[1]).toEqual(sentPrompts[0])
  })

  test("cannot promote or resurrect a draft closed during admission", async () => {
    search = { draftId: "draft-close" }
    let accept!: (value: PromptResult) => void
    promptResults = [
      new Promise<PromptResult>((resolve) => {
        accept = resolve
      }),
    ]

    const sending = normalSubmit().handleSubmit(event)
    while (sentPrompts.length === 0) await Bun.sleep(0)
    const owner = "server-key\ndraft:draft-close"
    invalidate(owner)
    accept({ data: undefined })
    await sending

    expect(draftPromotions).toEqual([])
    expect(promoted).toEqual([])
    expect(deletedSessions).toEqual(["session-1"])
    expect(removedOptimistic).toHaveLength(1)
  })

  for (const status of [400, 503]) {
    test(`deletes a settled ${status} provisional when its draft closes`, async () => {
      search = { draftId: `draft-close-${status}` }
      promptResults = [
        {
          error: { data: { message: "failed" } },
          response: new Response(null, { status }),
        },
      ]

      await normalSubmit().handleSubmit(event)
      invalidate(`server-key\ndraft:draft-close-${status}`)

      expect(deletedSessions).toEqual(["session-1"])
      expect(removedOptimistic).toHaveLength(1)
      expect(draftPromotions).toEqual([])
      expect(promoted).toEqual([])
    })
  }

  test("deletes a provisional returned after its draft closed during create", async () => {
    search = { draftId: "draft-close-create" }
    let created!: (value: { data?: Record<string, unknown> }) => void
    createResults = [
      new Promise((resolve) => {
        created = resolve
      }),
    ]

    const sending = normalSubmit().handleSubmit(event)
    while (createdSessions.length === 0) await Bun.sleep(0)
    invalidate("server-key\ndraft:draft-close-create")
    created({ data: { id: "session-created-late", title: "Late session" } })
    await sending

    expect(deletedSessions).toEqual(["session-created-late"])
    expect(draftPromotions).toEqual([])
    expect(promoted).toEqual([])
  })

  test("removes accepted optimistic state even when provisional deletion fails", async () => {
    search = { draftId: "draft-close-delete-failure" }
    deleteFails = true
    let accept!: (value: PromptResult) => void
    promptResults = [
      new Promise((resolve) => {
        accept = resolve
      }),
    ]

    const sending = normalSubmit().handleSubmit(event)
    while (sentPrompts.length === 0) await Bun.sleep(0)
    invalidate("server-key\ndraft:draft-close-delete-failure")
    accept({ data: undefined })
    await sending

    expect(deletedSessions).toEqual(["session-1"])
    expect(removedOptimistic).toHaveLength(1)
    expect(draftPromotions).toEqual([])
  })

  test("discards a failed pending worktree before retry", async () => {
    selected = "create"
    const sending = normalSubmit().handleSubmit(event)
    while (createdSessions.length === 0) await Bun.sleep(0)
    Worktree.failed(ServerScope.local, "/repo/main/new", "worktree failed")
    await sending

    const retry = normalSubmit().handleSubmit(event)
    while (createdSessions.length < 2) await Bun.sleep(0)
    Worktree.ready(ServerScope.local, "/repo/main/new")
    await retry

    expect(createdSessions).toEqual(["/repo/main/new", "/repo/main/new"])
    expect(deletedSessions).toEqual(["session-1"])
    expect(sentPrompts).toHaveLength(1)
  })

  test("retargets to a new worktree after authoritative rejection", async () => {
    promptResults = [
      { error: { data: { message: "invalid" } }, response: new Response(null, { status: 400 }) },
      { data: undefined },
    ]

    await normalSubmit().handleSubmit(event)
    selected = "/repo/worktree-b"
    await normalSubmit().handleSubmit(event)

    expect(createdSessions).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(deletedSessions).toEqual(["session-1"])
    expect(sentPrompts).toHaveLength(2)
    expect(sentPrompts[1]?.sessionID).toBe("session-2")
  })

  for (const draftID of [undefined, "draft-transfer"]) {
    test(`transfers edits made during admission for ${draftID ? "draft" : "direct"} routes`, async () => {
      search = draftID ? { draftId: draftID } : {}
      let accept!: (value: PromptResult) => void
      promptResults = [
        new Promise<PromptResult>((resolve) => {
          accept = resolve
        }),
      ]

      const sending = normalSubmit().handleSubmit(event)
      while (sentPrompts.length === 0) await Bun.sleep(0)
      promptValue = [{ type: "text", content: "edited while sending", start: 0, end: 20 }]
      promptCursor = 7
      promptMode = "shell"
      promptContext = [
        {
          type: "file",
          key: "file:src/index.ts:1:2:c=comment",
          path: "src/index.ts",
          comment: "changed comment",
          commentID: "comment",
        },
      ]
      commentsValue = [
        {
          id: "comment",
          file: "src/index.ts",
          selection: { start: 1, end: 2 },
          comment: "changed comment",
          time: 1,
        },
      ]
      accept({ data: undefined })
      await sending

      expect(replacements[0]).toEqual({
        value: {
          prompt: promptValue,
          cursor: 7,
          context: promptContext,
          mode: "shell",
        },
        scope: { dir: selected, id: "session-1" },
      })
      expect(commentReplacements).toEqual([{ value: commentsValue, scope: { dir: selected, id: "session-1" } }])
      expect(submitCallbacks).toBe(0)
    })
  }
})
