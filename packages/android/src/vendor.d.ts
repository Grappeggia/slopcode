declare module "@slopcode-ai/app/index.css"

declare module "@slopcode-ai/app/vite" {
  import type { PluginOption } from "vite"

  const plugin: PluginOption | PluginOption[]
  export default plugin
}
