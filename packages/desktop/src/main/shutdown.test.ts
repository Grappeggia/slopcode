import { expect, test } from "bun:test"
import { stopServices } from "./shutdown"

test("runs final service cleanup when another shutdown rejects", async () => {
  const failure = new Error("SSH cleanup failed")
  let finished = false
  await expect(
    stopServices([Promise.resolve(), Promise.reject(failure)], () => {
      finished = true
    }),
  ).rejects.toBe(failure)
  expect(finished).toBe(true)
})

test("reports all shutdown failures after final cleanup", async () => {
  let finished = false
  const result = stopServices([Promise.reject(new Error("local")), Promise.reject(new Error("SSH"))], () => {
    finished = true
  })
  await expect(result).rejects.toBeInstanceOf(AggregateError)
  expect(finished).toBe(true)
})
