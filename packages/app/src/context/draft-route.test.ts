import { expect, test } from "bun:test"
import { draftRouteKey } from "./draft-route"

test("keeps same-directory drafts in distinct provider scopes", () => {
  expect(draftRouteKey("draft-a", "/workspace")).not.toBe(draftRouteKey("draft-b", "/workspace"))
  expect(draftRouteKey("draft-a", "/workspace")).not.toBe(draftRouteKey("draft-a", "/other-workspace"))
})
