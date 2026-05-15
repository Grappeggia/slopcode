import fs from "fs/promises"
import path from "path"
import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./repo_overview.txt"
import { assertExternalDirectory } from "./external-directory"
import { Instance } from "@/project/instance"
import { parseRepositoryReference, repositoryCachePath } from "@/util/repository"

const IGNORED_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".next", "target", "vendor"])
const STRUCTURE_LIMIT = 200
const DEPENDENCY_FILES = [
  "package.json",
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  "pnpm-lock.yaml",
  "yarn.lock",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "build.gradle",
  "build.gradle.kts",
  "pom.xml",
  "composer.json",
]

const parameters = z.object({
  repository: z
    .string()
    .describe("Cached repository to inspect, as a git URL, host/path reference, or GitHub owner/repo shorthand")
    .optional(),
  path: z.string().describe("Directory path to inspect instead of a cached repository").optional(),
  depth: z.number().describe("Maximum structure depth to include. Defaults to 3.").optional(),
})

async function exists(target: string) {
  return fs.stat(target).then(() => true).catch(() => false)
}

function packageManager(files: Set<string>) {
  if (files.has("bun.lock") || files.has("bun.lockb")) return "bun"
  if (files.has("pnpm-lock.yaml")) return "pnpm"
  if (files.has("yarn.lock")) return "yarn"
  if (files.has("package-lock.json")) return "npm"
}

function ecosystems(files: Set<string>) {
  return [
    ...(files.has("package.json") ? ["Node.js"] : []),
    ...(files.has("pyproject.toml") || files.has("requirements.txt") ? ["Python"] : []),
    ...(files.has("go.mod") ? ["Go"] : []),
    ...(files.has("Cargo.toml") ? ["Rust"] : []),
    ...(files.has("Gemfile") ? ["Ruby"] : []),
    ...(files.has("build.gradle") || files.has("build.gradle.kts") || files.has("pom.xml") ? ["Java/Kotlin"] : []),
    ...(files.has("composer.json") ? ["PHP"] : []),
  ]
}

async function run(args: string[], cwd: string) {
  const proc = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  if (code !== 0) return
  return stdout.trim() || undefined
}

async function structure(root: string, depth: number) {
  let truncated = false
  const lines: string[] = []

  async function visit(dir: string, level: number) {
    if (level >= depth || lines.length >= STRUCTURE_LIMIT) {
      truncated = truncated || lines.length >= STRUCTURE_LIMIT
      return
    }

    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .then((items) =>
        items
          .filter((entry) => !IGNORED_DIRS.has(entry.name))
          .map((entry) => ({ name: entry.name, full: path.join(dir, entry.name), directory: entry.isDirectory() }))
          .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)),
      )
      .catch(() => [])

    for (const entry of entries) {
      if (lines.length >= STRUCTURE_LIMIT) {
        truncated = true
        return
      }
      lines.push(`${"  ".repeat(level)}${entry.name}${entry.directory ? "/" : ""}`)
      if (entry.directory) await visit(entry.full, level + 1)
    }
  }

  await visit(root, 0)
  return { lines, truncated }
}

function resolveTarget(params: z.infer<typeof parameters>) {
  if (params.path) {
    return {
      path: path.isAbsolute(params.path) ? params.path : path.resolve(Instance.directory, params.path),
      repository: params.repository,
    }
  }

  if (!params.repository) throw new Error("Either repository or path is required")
  const parsed = parseRepositoryReference(params.repository)
  if (!parsed) throw new Error("Repository must be a git URL, host/path reference, or GitHub owner/repo shorthand")
  return {
    repository: parsed.label,
    path: repositoryCachePath(parsed),
  }
}

export const RepoOverviewTool = Tool.define("repo_overview", {
  description: DESCRIPTION,
  parameters,
  async execute(params, ctx) {
    const target = resolveTarget(params)
    const depth = !params.depth || !Number.isInteger(params.depth) || params.depth < 1 || params.depth > 6 ? 3 : params.depth

    await assertExternalDirectory(ctx, target.path, { kind: "directory" })
    await ctx.ask({
      permission: "repo_overview",
      patterns: [target.repository ?? target.path],
      always: [target.repository ?? target.path],
      metadata: {
        repository: target.repository,
        path: target.path,
        depth,
      },
    })

    if (!(await exists(target.path))) {
      if (target.repository) throw new Error(`Repository is not cloned: ${target.repository}. Use repo_clone first.`)
      throw new Error(`Directory not found: ${target.path}`)
    }

    const stat = await fs.stat(target.path)
    if (!stat.isDirectory()) throw new Error(`Path is not a directory: ${target.path}`)

    const entries = await fs.readdir(target.path, { withFileTypes: true }).catch(() => [])
    const topLevel = new Set(entries.map((entry) => entry.name))
    const dependencyFiles = DEPENDENCY_FILES.filter((file) => topLevel.has(file))
    const packageJson = topLevel.has("package.json")
      ? await Bun.file(path.join(target.path, "package.json")).json().catch(() => ({} as Record<string, unknown>))
      : {}
    const entrypoints = [
      ...(typeof packageJson.main === "string" ? [`main: ${packageJson.main}`] : []),
      ...(typeof packageJson.module === "string" ? [`module: ${packageJson.module}`] : []),
      ...(typeof packageJson.types === "string" ? [`types: ${packageJson.types}`] : []),
      ...(typeof packageJson.bin === "string" ? [`bin: ${packageJson.bin}`] : []),
      ...(packageJson.bin && typeof packageJson.bin === "object" && !Array.isArray(packageJson.bin)
        ? Object.keys(packageJson.bin as Record<string, unknown>).map((name) => `bin: ${name}`)
        : []),
      ...(packageJson.exports && typeof packageJson.exports === "object" && !Array.isArray(packageJson.exports)
        ? Object.keys(packageJson.exports as Record<string, unknown>)
            .slice(0, 10)
            .map((name) => `exports: ${name}`)
        : []),
    ]
    const tree = await structure(target.path, depth)
    const branch = await run(["git", "branch", "--show-current"], target.path)
    const head = await run(["git", "rev-parse", "HEAD"], target.path)
    const detected = ecosystems(topLevel)
    const manager = packageManager(topLevel)

    return {
      title: target.repository ?? path.basename(target.path),
      metadata: {
        path: target.path,
        repository: target.repository,
        branch,
        head,
        package_manager: manager,
        ecosystems: detected,
        dependency_files: dependencyFiles,
        entrypoints,
        depth,
        truncated: tree.truncated,
      },
      output: [
        `Path: ${target.path}`,
        ...(target.repository ? [`Repository: ${target.repository}`] : []),
        ...(branch ? [`Branch: ${branch}`] : []),
        ...(head ? [`HEAD: ${head}`] : []),
        ...(detected.length ? [`Ecosystems: ${detected.join(", ")}`] : []),
        ...(manager ? [`Package manager: ${manager}`] : []),
        ...(dependencyFiles.length ? [`Dependency files: ${dependencyFiles.join(", ")}`] : []),
        ...(entrypoints.length ? ["Likely entrypoints:", ...entrypoints.map((entry) => `- ${entry}`)] : []),
        "Top-level structure:",
        ...tree.lines,
        ...(tree.truncated ? ["(Structure truncated)"] : []),
      ].join("\n"),
    }
  },
})
