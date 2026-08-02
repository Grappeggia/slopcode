import { describe, expect, test } from "bun:test"
import {
  clampReviewSidebarWidth,
  reviewPanelV2Storage,
  reviewSidebarDefault,
  reviewSidebarMax,
  reviewSidebarMin,
  toggleReviewSidebar,
} from "./review-panel-v2-state"

describe("review v2 sidebar state", () => {
  test("uses a stable global persisted target", () => {
    expect(reviewPanelV2Storage).toEqual({ storage: "slopcode.global.dat", key: "review-panel-v2" })
  })

  test("clamps sidebar resize values", () => {
    expect(clampReviewSidebarWidth(1)).toBe(reviewSidebarMin)
    expect(clampReviewSidebarWidth(reviewSidebarDefault)).toBe(reviewSidebarDefault)
    expect(clampReviewSidebarWidth(999)).toBe(reviewSidebarMax)
  })

  test("toggles sidebar visibility", () => {
    expect(toggleReviewSidebar(true)).toBe(false)
    expect(toggleReviewSidebar(false)).toBe(true)
  })
})
