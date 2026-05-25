export * from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { SlopcodeClient } from "./gen/sdk.gen.js"
export { type Config as SlopcodeClientConfig, SlopcodeClient }

export function createSlopcodeClient(config?: Config & { directory?: string; viewID?: string; workspaceID?: string }) {
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      // @ts-ignore
      req.timeout = false
      return fetch(req)
    }
    config = {
      ...config,
      fetch: customFetch,
    }
  }

  if (config?.directory) {
    const isNonASCII = /[^\x00-\x7F]/.test(config.directory)
    const encodedDirectory = isNonASCII ? encodeURIComponent(config.directory) : config.directory
    config.headers = {
      ...config.headers,
      "x-slopcode-directory": encodedDirectory,
    }
  }

  if (config?.viewID) {
    config.headers = {
      ...config.headers,
      "x-slopcode-view-id": config.viewID,
    }
  }

  if (config?.workspaceID) {
    config.headers = {
      ...config.headers,
      "x-slopcode-workspace": config.workspaceID,
    }
  }

  const client = createClient(config)
  return new SlopcodeClient({ client })
}
