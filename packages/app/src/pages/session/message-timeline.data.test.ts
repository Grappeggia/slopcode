import { describe, expect, test } from "bun:test"
import { reconcileTimelineRows, TimelineRow } from "./message-timeline-rows"

describe("timeline row reconciliation", () => {
  test("retains stable rows across large streaming updates", () => {
    const previous = Array.from(
      { length: 2_000 },
      (_, index) =>
        new TimelineRow.UserMessage({
          userMessageID: `message-${index}`,
          anchor: true,
          previousUserMessage: index > 0,
        }),
    )
    const next = previous.map(
      (row, index) =>
        new TimelineRow.UserMessage({
          userMessageID: row.userMessageID,
          anchor: index === previous.length - 1 ? false : row.anchor,
          previousUserMessage: row.previousUserMessage,
        }),
    )

    const rows = reconcileTimelineRows(previous, next)
    expect(rows).toHaveLength(previous.length)
    expect(rows[0]).toBe(previous[0])
    expect(rows[1_998]).toBe(previous[1_998])
    expect(rows[1_999]).not.toBe(previous[1_999])
  })

  test("keeps streaming status rows keyed to their turn", () => {
    const rows = [
      new TimelineRow.Thinking({ userMessageID: "message-1" }),
      new TimelineRow.Retry({ userMessageID: "message-1" }),
      new TimelineRow.BottomSpacer(),
    ]
    expect(rows.map(TimelineRow.key)).toEqual(["thinking:message-1", "retry:message-1", "bottom-spacer"])
  })
})
