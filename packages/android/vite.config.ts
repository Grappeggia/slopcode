import appPlugin from "@slopcode-ai/app/vite"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: Array.isArray(appPlugin) ? appPlugin : [appPlugin],
  base: "./",
  publicDir: fileURLToPath(new URL("../app/public", import.meta.url)),
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "solid-js",
  },
  resolve: {
    alias: {
      "@android": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "esnext",
  },
})
