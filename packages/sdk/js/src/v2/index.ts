export * from "./client.js"
export * from "./server.js"
export { abortableSleep } from "../sse.js"

import { createSlopcodeClient } from "./client.js"
import { createSlopcodeServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createSlopcode(options?: ServerOptions) {
  const server = await createSlopcodeServer({
    ...options,
  })

  const client = createSlopcodeClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
