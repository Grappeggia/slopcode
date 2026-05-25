import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { createRequire } from "module"
import z from "zod"
import { Glob } from "@/util/glob"
import { isPathPluginSpec, parsePluginSpecifier, resolvePathPluginTarget } from "@/plugin/shared"

export namespace ConfigPlugin {
  export const Options = z.record(z.string(), z.unknown())
  export type Options = z.output<typeof Options>

  export const Spec = z.union([z.string(), z.tuple([z.string(), Options])])
  export type Spec = z.output<typeof Spec>

  export type Scope = "global" | "local"

  export type Origin = {
    spec: Spec
    source: string
    scope: Scope
  }

  export async function load(dir: string) {
    const plugins: Spec[] = []
    for (const item of await Glob.scan("{plugin,plugins}/*.{ts,js}", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      plugins.push(pathToFileURL(item).href)
    }
    return plugins
  }

  export function pluginSpecifier(plugin: Spec): string {
    return Array.isArray(plugin) ? plugin[0] : plugin
  }

  export function pluginOptions(plugin: Spec): Options | undefined {
    return Array.isArray(plugin) ? plugin[1] : undefined
  }

  export async function resolvePluginSpec(plugin: Spec, configFilepath: string): Promise<Spec> {
    const spec = pluginSpecifier(plugin)
    if (!isPathPluginSpec(spec)) {
      const resolved = await Promise.resolve()
        .then(() => pathToFileURL(createRequire(configFilepath).resolve(spec)).href)
        .catch(() => undefined)
      if (!resolved) return plugin
      if (Array.isArray(plugin)) return [resolved, plugin[1]]
      return resolved
    }
    const base = path.dirname(configFilepath)
    const file = (() => {
      if (spec.startsWith("file://")) return spec
      if (path.isAbsolute(spec) || /^[A-Za-z]:[\\/]/.test(spec)) return pathToFileURL(spec).href
      return pathToFileURL(path.resolve(base, spec)).href
    })()
    const resolved = await resolvePathPluginTarget(file).catch(() => file)

    if (Array.isArray(plugin)) return [resolved, plugin[1]]
    return resolved
  }

  export function deduplicatePluginOrigins(plugins: Origin[]): Origin[] {
    const seen = new Set<string>()
    const list: Origin[] = []

    for (const plugin of plugins.toReversed()) {
      const spec = pluginSpecifier(plugin.spec)
      const name = spec.startsWith("file://") ? path.parse(fileURLToPath(spec)).name : parsePluginSpecifier(spec).pkg
      if (seen.has(name)) continue
      seen.add(name)
      list.push(plugin)
    }

    return list.toReversed()
  }
}
