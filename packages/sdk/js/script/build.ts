#!/usr/bin/env bun
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

import { $ } from "bun"
import path from "path"

import { createClient } from "@hey-api/openapi-ts"

const slopcode = path.resolve(dir, "../../slopcode")

await $`bun dev generate > ${dir}/openapi.json`.cwd(slopcode)

await createClient({
  input: "./openapi.json",
  output: {
    path: "./src/v2/gen",
    tsConfigPath: path.join(dir, "tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "SlopcodeClient",
      exportFromIndex: false,
      auth: false,
      paramsStructure: "flat",
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:4096",
    },
  ],
})

// Patch a @hey-api/openapi-ts codegen bug: SseFn incorrectly passes the
// endpoint's TError into the second generic of ServerSentEventsResult, which
// is the AsyncGenerator's TReturn slot. Iterator return values have nothing
// to do with HTTP errors, and any consumer that calls `.return()` or returns
// from a mock generator gets type-checked against the wrong shape. Drop the
// arg so TReturn defaults to void.
const sseTypesPath = "./src/v2/gen/client/types.gen.ts"
const sseTypesFile = Bun.file(sseTypesPath)
const sseTypesSource = await sseTypesFile.text()
const sseTypesPatched = sseTypesSource.replace(
  "=> Promise<ServerSentEventsResult<TData, TError>>",
  "=> Promise<ServerSentEventsResult<TData>>",
)
if (sseTypesPatched === sseTypesSource) {
  throw new Error(`SseFn patch did not apply; @hey-api/openapi-ts output may have changed (${sseTypesPath})`)
}
await Bun.write(sseTypesPath, sseTypesPatched)

// Keep SSE retry backoff owned by the request's AbortSignal. The generated
// client otherwise waits for the full exponential delay after aborting.
const sseRuntimePath = "./src/v2/gen/core/serverSentEvents.gen.ts"
const sseRuntimeFile = Bun.file(sseRuntimePath)
const sseRuntimeSource = await sseRuntimeFile.text()
const replacements = [
  [
    /import type \{ Config \} from ['"]\.\/types\.gen\.js['"];?/,
    'import type { Config } from "./types.gen.js"\nimport { abortableSleep } from "../../../sse.js"',
  ],
  [
    /sseSleepFn\?: \(ms: number\) => Promise<void>;?/,
    "sseSleepFn?: (ms: number, signal: AbortSignal) => Promise<void>",
  ],
  [
    /const sleep =\s*sseSleepFn \?\?\s*\(\(ms: number\) => new Promise\(\(resolve\) => setTimeout\(resolve, ms\)\)\);?/,
    "const sleep = sseSleepFn ?? abortableSleep",
  ],
  [/onSseError\?\.\(error\);?/, "onSseError?.(error)\n\n        if (signal.aborted) break"],
  [/await sleep\(backoff\);?/, "await sleep(backoff, signal)"],
] as const
const sseRuntimePatched = replacements.reduce((source, [before, after]) => {
  if (!before.test(source)) {
    throw new Error(`SSE runtime patch did not apply; @hey-api/openapi-ts output may have changed (${sseRuntimePath})`)
  }
  return source.replace(before, after)
}, sseRuntimeSource)
await Bun.write(sseRuntimePath, sseRuntimePatched)

await $`bun prettier --write src/gen`
await $`bun prettier --write src/v2`
await $`rm -rf dist`
await $`bun tsc`
await $`rm openapi.json`
