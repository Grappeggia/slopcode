/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { tmpdir } from "../../../fixture/fixture"
import { json, mount, wait } from "./sync-fixture"
import type { GlobalEvent } from "@slopcode-ai/sdk/v2"

function branchEvent(branch: string, workspace?: string): GlobalEvent {
  return {
    directory: "/tmp/other",
    project: "proj_test",
    workspace,
    payload: {
      id: `evt_vcs_${branch}`,
      type: "vcs.branch.updated",
      properties: { branch },
    },
  }
}

describe("tui sync", () => {
  test("refresh scopes sessions by default and lists project sessions when disabled", async () => {
    await using tmp = await tmpdir()
    await Bun.write(`${tmp.path}/kv.json`, "{}")
    const { app, kv, sync, session } = await mount(undefined, tmp.path)

    try {
      expect(kv.get("session_directory_filter_enabled", true)).toBe(true)
      expect(session.at(-1)?.searchParams.get("scope")).toBeNull()
      expect(session.at(-1)?.searchParams.get("path")).toBe("packages/tui")

      kv.set("session_directory_filter_enabled", false)
      await sync.session.refresh()

      expect(session.at(-1)?.searchParams.get("scope")).toBe("project")
      expect(session.at(-1)?.searchParams.get("path")).toBeNull()
    } finally {
      app.renderer.destroy()
    }
  })

  test("vcs branch updates only apply for the active workspace", async () => {
    await using tmp = await tmpdir()
    await Bun.write(`${tmp.path}/kv.json`, "{}")
    const { app, emit, project, sync } = await mount(undefined, tmp.path)

    try {
      expect(sync.data.vcs?.branch).toBe("main")

      project.workspace.set("ws_a")
      emit(branchEvent("other", "ws_b"))
      await Bun.sleep(30)

      expect(sync.data.vcs?.branch).toBe("main")

      emit(branchEvent("feature", "ws_a"))
      await wait(() => sync.data.vcs?.branch === "feature")

      expect(sync.data.vcs?.branch).toBe("feature")
    } finally {
      app.renderer.destroy()
    }
  })

  test("auto mode approves a forecast batch once with every request selected", async () => {
    await using tmp = await tmpdir()
    await Bun.write(`${tmp.path}/kv.json`, "{}")
    const replies: unknown[] = []
    const { app, emit } = await mount(
      async (url, request): Promise<Response | undefined> => {
        if (url.pathname !== "/permission/batch/pmb_auto/reply") return undefined
        replies.push(await request?.json())
        return json(true)
      },
      tmp.path,
      { auto: true },
    )

    const permission = (id: string): GlobalEvent => ({
      directory: "/tmp/slopcode/packages/tui",
      project: "proj_test",
      payload: {
        id: `evt_${id}`,
        type: "permission.asked",
        properties: {
          id,
          sessionID: "ses_auto",
          permission: "bash",
          patterns: [id],
          metadata: {},
          always: [id],
          kind: "forecast",
          batchID: "pmb_auto",
          batchSize: 2,
        },
      },
    })

    try {
      emit(permission("per_a"))
      await Bun.sleep(20)
      expect(replies).toEqual([])

      emit(permission("per_b"))
      await wait(() => replies.length === 1)

      expect(replies).toEqual([{ requestIDs: ["per_a", "per_b"], reply: "once" }])
    } finally {
      app.renderer.destroy()
    }
  })
})
