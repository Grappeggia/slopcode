import { beforeAll, describe, expect, mock, test } from "bun:test"

let promptQueueRows: typeof import("./queue-dock").promptQueueRows
let promptQueueVisible: typeof import("./queue-dock").promptQueueVisible

beforeAll(async () => {
  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => ({}),
  }))
  mock.module("@slopcode-ai/ui/button", () => ({
    Button: (props: { children?: unknown }) => props.children,
  }))
  mock.module("@slopcode-ai/ui/dock-surface", () => ({
    DockTray: (props: { children?: unknown }) => props.children,
  }))
  mock.module("@slopcode-ai/ui/icon-button", () => ({
    IconButton: () => null,
  }))
  mock.module("@/context/sdk", () => ({
    useSDK: () => ({ directory: "/repo/main" }),
  }))
  mock.module("@/context/sync", () => ({
    useSync: () => ({ data: { session_status: {} } }),
  }))

  const mod = await import("./queue-dock")
  promptQueueRows = mod.promptQueueRows
  promptQueueVisible = mod.promptQueueVisible
})

describe("prompt queue dock", () => {
  test("shows when only the active item exists", () => {
    expect(
      promptQueueVisible({
        active: {
          key: "session",
          id: "active-1",
          summary: "working prompt",
          time: { queued: 1, started: 1 },
          ready: () => true,
          done: () => false,
          run: async () => undefined,
          reject: () => undefined,
        },
        queue: [],
      }),
    ).toBe(true)
  })

  test("shows when queued items exist", () => {
    expect(
      promptQueueVisible({
        active: undefined,
        queue: [
          {
            key: "session",
            id: "queued-1",
            summary: "queued prompt",
            time: { queued: 1 },
            ready: () => false,
            done: () => false,
            run: async () => undefined,
            reject: () => undefined,
          },
        ],
      }),
    ).toBe(true)
  })

  test("keeps the active item visible and relabels it as Active", () => {
    expect(
      promptQueueRows({
        active: {
          key: "session",
          id: "active-1",
          summary: "first prompt",
          time: { queued: 1, started: 1 },
          ready: () => true,
          done: () => false,
          run: async () => undefined,
          reject: () => undefined,
        },
        queue: [
          {
            key: "session",
            id: "queued-1",
            summary: "second prompt",
            time: { queued: 1 },
            ready: () => false,
            done: () => false,
            run: async () => undefined,
            reject: () => undefined,
          },
        ],
      }),
    ).toEqual([
      {
        id: "active-1",
        label: "Active",
        summary: "first prompt",
        detail: undefined,
        time: { queued: 1, started: 1 },
      },
      {
        id: "queued-1",
        label: "Queued",
        summary: "second prompt",
        detail: undefined,
        time: { queued: 1 },
      },
    ])
  })
})
