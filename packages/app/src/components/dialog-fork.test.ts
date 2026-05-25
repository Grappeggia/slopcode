import { describe, expect, test } from "bun:test"
import { forkTabs } from "./dialog-fork-state"

describe("forkTabs", () => {
  test("keeps file and context tabs with the current active tab", () => {
    expect(
      forkTabs({
        all: ["context", "file://package.json"],
        active: "context",
      }),
    ).toEqual({
      all: ["context", "file://package.json"],
      active: "context",
    })
  })

  test("drops review and falls back to the first carried tab", () => {
    expect(
      forkTabs({
        all: ["review", "context", "file://README.md"],
        active: "review",
      }),
    ).toEqual({
      all: ["context", "file://README.md"],
      active: "context",
    })
  })
})
