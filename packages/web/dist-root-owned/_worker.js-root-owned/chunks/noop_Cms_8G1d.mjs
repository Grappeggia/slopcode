globalThis.process ??= {}
globalThis.process.env ??= {}
import { b as baseService } from "./_astro_assets_VXEWGxWQ.mjs"

const noopService = {
  ...baseService,
  propertiesToHash: ["src"],
  async transform(inputBuffer, transformOptions) {
    return {
      data: inputBuffer,
      format: transformOptions.format,
    }
  },
}
var noop_default = noopService

export { noop_default as default }
