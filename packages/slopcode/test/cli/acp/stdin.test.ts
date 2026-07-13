import { expect, test } from "bun:test"
import { once } from "node:events"
import { PassThrough } from "node:stream"
import { Duration, Effect } from "effect"
import { waitForEnd } from "@/cli/cmd/acp"

test("ACP stdin EOF wait resolves after end was emitted", async () => {
  const input = new PassThrough()
  input.end()
  input.resume()
  await once(input, "end")

  expect(input.readableEnded).toBe(true)
  await Effect.runPromise(Effect.promise(() => waitForEnd(input)).pipe(Effect.timeout(Duration.millis(100))))
})
