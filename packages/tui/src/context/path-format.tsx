import path from "path"
import type { LocationRef } from "@slopcode-ai/sdk/v2"
import { createContext, useContext, type ParentProps } from "solid-js"
import { abbreviateHome } from "../runtime"
import { LocationProvider } from "./location"
import { useTuiPaths } from "./runtime"

const context = createContext<{
  path: () => string
  format: (input?: string) => string
}>()

export function PathFormatterProvider(props: ParentProps<{ location: LocationRef | undefined }>) {
  const paths = useTuiPaths()
  const base = () => props.location?.directory || paths.cwd
  return (
    <LocationProvider location={props.location}>
      <context.Provider
        value={{
          path: base,
          format: (input) => formatPath(input, base(), paths.home),
        }}
      >
        {props.children}
      </context.Provider>
    </LocationProvider>
  )
}

export function usePathFormatter() {
  const value = useContext(context)
  if (!value) throw new Error("PathFormatter context must be used within a PathFormatterProvider")
  return value
}

function formatPath(input: string | undefined, base: string, home: string) {
  if (typeof input !== "string" || !input) return ""

  const absolute = path.isAbsolute(input) ? input : path.resolve(base, input)
  const relative = path.relative(base, absolute)

  if (!relative) return "."
  if (relative !== ".." && !relative.startsWith(".." + path.sep)) return relative
  return abbreviateHome(absolute, home)
}
