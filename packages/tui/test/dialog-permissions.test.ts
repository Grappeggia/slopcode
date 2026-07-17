import { expect, test } from "bun:test"
import { createSlopcodeClient, type PermissionSavedInfo } from "@slopcode-ai/sdk/v2"
import * as fuzzysort from "fuzzysort"
import {
  permissionRemove,
  permissionRemoveStep,
  permissionSavedList,
  permissionSavedRemove,
  permissionSavedRows,
} from "../src/component/dialog-permissions.shared"

const items: PermissionSavedInfo[] = [
  {
    id: "psv_b",
    projectID: "scope",
    scope: "project",
    match: "pattern",
    action: "read",
    resource: "src/**/*.ts",
  },
  {
    id: "psv_a",
    projectID: "scope",
    scope: "project",
    match: "pattern",
    action: "bash",
    resource: "git status",
  },
]

test("routes list and removal through the active client location", async () => {
  const requests: Array<{ url: URL; method: string; workspace: string | null }> = []
  const fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      requests.push({
        url: new URL(request.url),
        method: request.method,
        workspace: request.headers.get("x-slopcode-workspace"),
      })
      if (request.method === "DELETE") return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ data: items }), { headers: { "content-type": "application/json" } })
    },
    { preconnect: () => undefined },
  )
  const sdk = createSlopcodeClient({ baseUrl: "http://localhost", directory: "/current/folder", fetch })

  const result = await permissionSavedList(sdk, "wrk_current")
  await permissionSavedRemove(sdk, "psv_a", "wrk_current")

  expect(result.map((item) => item.id)).toEqual(["psv_a", "psv_b"])
  expect(requests[0].method).toBe("GET")
  expect(requests[0].url.searchParams.get("location[directory]")).toBe("/current/folder")
  expect(requests[0].url.searchParams.get("location[workspace]")).toBe("wrk_current")
  expect(requests[0].url.searchParams.has("projectID")).toBe(false)
  expect(requests[1]).toMatchObject({ method: "DELETE", workspace: "wrk_current" })
})

test("filtered removal keeps stable search fields through both delete presses", () => {
  const rows = permissionSavedRows(items, { scope: "project" })
  const filtered = fuzzysort.go("git status", rows, { keys: ["title", "category"] })
  expect(filtered.map((item) => item.obj.id)).toEqual(["psv_a"])

  const armed = permissionRemoveStep(undefined, "psv_a")
  const confirming = permissionSavedRows(items, { scope: "project", confirming: armed.confirming })
  const stillFiltered = fuzzysort.go("git status", confirming, { keys: ["title", "category"] })
  expect(stillFiltered.map((item) => item.obj.id)).toEqual(["psv_a"])
  expect(stillFiltered[0].obj).toMatchObject({
    title: "bash: git status",
    description: "Revoke this permission? Press delete again",
  })
  expect(permissionRemoveStep(armed.confirming, stillFiltered[0].obj.id)).toEqual({
    confirming: undefined,
    remove: true,
  })
})

test("separates removal failures from post-removal refresh failures", async () => {
  let refreshed = 0
  expect(
    await permissionRemove({
      remove: () => Promise.resolve({}),
      refresh: async () => {
        refreshed += 1
      },
    }),
  ).toEqual({ status: "removed" })
  expect(refreshed).toBe(1)

  expect(
    await permissionRemove({
      remove: () => Promise.resolve({ error: new Error("scope remove failed") }),
      refresh: async () => {
        refreshed += 1
      },
    }),
  ).toMatchObject({ status: "remove_failed", error: new Error("scope remove failed") })
  expect(refreshed).toBe(1)

  expect(
    await permissionRemove({
      remove: () => Promise.resolve({}),
      refresh: () => Promise.reject(new Error("scope refresh failed")),
    }),
  ).toMatchObject({ status: "refresh_failed", error: new Error("scope refresh failed") })
})

test("listing surfaces current-location API failures", async () => {
  const sdk = createSlopcodeClient({
    baseUrl: "http://localhost",
    fetch: Object.assign(() => Promise.reject(new Error("scope list failed")), {
      preconnect: () => undefined,
    }),
  })
  expect(permissionSavedList(sdk)).rejects.toThrow("scope list failed")
})
