import { describe, expect, test } from "bun:test"
import type { Message } from "@slopcode-ai/sdk/v2/client"
import { messageBatches, messagePartsComplete } from "./session-message"

const msg = (id: string) => ({ id }) as Message

describe("messagePartsComplete", () => {
  test("returns false when any message is missing parts", () => {
    expect(messagePartsComplete([msg("a"), msg("b")], { a: [] })).toBe(false)
  })

  test("returns true when every message has a parts entry", () => {
    expect(messagePartsComplete([msg("a"), msg("b")], { a: [], b: [] })).toBe(true)
  })
})

describe("messageBatches", () => {
  test("returns newest pending message ids first in fixed batches", () => {
    const messages = [msg("a"), msg("b"), msg("c"), msg("d"), msg("e")]
    const batches = messageBatches(messages, { a: [], c: [] }, 2)
    expect(batches).toEqual([["d", "e"], ["b"]])
  })
})
