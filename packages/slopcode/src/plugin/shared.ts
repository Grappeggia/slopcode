import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { BunProc } from "@/bun"
import { Filesystem } from "@/util/filesystem"

export const DEPRECATED_PLUGIN_PACKAGES = ["slopcode-openai-codex-auth", "slopcode-copilot-auth"]

export function isDeprecatedPlugin(spec: string) {
  return DEPRECATED_PLUGIN_PACKAGES.some((pkg) => spec.includes(pkg))
}

export function parsePluginSpecifier(spec: string) {
  const index = spec.lastIndexOf("@")
  const pkg = index > 0 ? spec.slice(0, index) : spec
  const version = index > 0 ? spec.slice(index + 1) : "latest"
  return { pkg, version }
}

export type PluginPackage = {
  dir: string
  pkg: string
  json: Record<string, unknown>
}

const INDEX = ["index.ts", "index.tsx", "index.js", "index.mjs", "index.cjs"]

export function isPathPluginSpec(spec: string) {
  return spec.startsWith("file://") || spec.startsWith(".") || path.isAbsolute(spec) || /^[A-Za-z]:[\\/]/.test(spec)
}

async function resolveDirectoryIndex(dir: string) {
  for (const name of INDEX) {
    const file = path.join(dir, name)
    if (await Filesystem.exists(file)) return file
  }
}

export async function resolvePathPluginTarget(spec: string) {
  const raw = spec.startsWith("file://") ? fileURLToPath(spec) : spec
  const file = path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw) ? raw : path.resolve(raw)
  const stat = Filesystem.stat(file)
  if (!stat?.isDirectory()) {
    if (spec.startsWith("file://")) return spec
    return pathToFileURL(file).href
  }

  if (await Filesystem.exists(path.join(file, "package.json"))) {
    return pathToFileURL(file).href
  }

  const index = await resolveDirectoryIndex(file)
  if (index) return pathToFileURL(index).href
  throw new Error(`Plugin directory ${file} is missing package.json or index file`)
}

export async function resolvePluginTarget(spec: string, parsed = parsePluginSpecifier(spec)) {
  if (isPathPluginSpec(spec)) return resolvePathPluginTarget(spec)
  return BunProc.install(parsed.pkg, parsed.version)
}

export async function readPluginPackage(target: string): Promise<PluginPackage> {
  const file = target.startsWith("file://") ? fileURLToPath(target) : target
  const stat = Filesystem.stat(file)
  const dir = stat?.isDirectory() ? file : path.dirname(file)
  const pkg = path.join(dir, "package.json")
  const json = await Filesystem.readJson<Record<string, unknown>>(pkg)
  return { dir, pkg, json }
}
