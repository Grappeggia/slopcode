import { AppProcess } from "@slopcode-ai/core/process"
import { InstanceRef } from "@/effect/instance-ref"
import { Effect, Duration, Stream } from "effect"
import { open, opendir, lstat, realpath } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { ChildProcess } from "effect/unstable/process"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import {
  CODEX_TIMEOUT,
  MAX_REMOTE_AGENT_CATALOG_BYTES,
  MAX_REMOTE_AGENT_COMMANDS,
  MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH,
  MAX_REMOTE_AGENT_COMMAND_NAME_LENGTH,
  MAX_REMOTE_AGENT_COMMAND_VALUE_LENGTH,
  MAX_REMOTE_AGENT_VERSION_LENGTH,
  MAX_CODEX_OUTPUT_BYTES,
  MAX_REMOTE_ENTRIES,
  MAX_REMOTE_ENTRY_NAME_LENGTH,
  MAX_REMOTE_PATH_LENGTH,
  RemoteAgent,
  RemoteAgentCatalog,
  RemoteAgentCatalogQuery,
  RemoteAgentCommand,
  RemoteAgentConfig,
  RemoteAgentPrompt,
  RemoteAgentPromptQuery,
  RemoteBrowseResult,
  REMOTE_AGENT_VERSION_TIMEOUT,
} from "../groups/remote-runtime"
import { InstanceHttpApi } from "../api"
import { ApiNotFoundError, ForbiddenError, InvalidRequestError, ServiceUnavailableError } from "../errors"

const CODEX_FORCE_KILL_AFTER = Duration.seconds(2)
const SSH_BROWSE_TIMEOUT = Duration.seconds(15)
const MAX_SSH_BROWSE_OUTPUT_BYTES = 256 * 1024
const AGENT_EXECUTABLES = {
  "codex-cli": "codex",
  "opencode-cli": "opencode",
  "claude-code": "claude",
} as const
const AGENT_COMMANDS = {
  "codex-cli": "exec",
  "opencode-cli": "run",
  "claude-code": "-p",
} as const
const MAX_REMOTE_AGENT_VERSION_OUTPUT_BYTES = 4 * 1024
const MAX_REMOTE_AGENT_METADATA_BYTES = 8 * 1024
const MAX_REMOTE_AGENT_DISCOVERY_FILES = 512
const MAX_REMOTE_AGENT_COMMAND_DEPTH = 8
const AGENT_COMMAND_DIRECTORIES = {
  "codex-cli": [".codex/prompts", ".codex/commands"],
  "opencode-cli": [".opencode/commands", "commands"],
  "claude-code": [".claude/commands"],
} as const
const ENTRY_TYPE_RANK = {
  directory: 0,
  file: 1,
  symlink: 2,
  other: 3,
} as const

type Entry = (typeof RemoteBrowseResult.Type.entries)[number]
type Config = typeof RemoteAgentConfig.Type
type Agent = typeof RemoteAgent.Type
type Command = typeof RemoteAgentCommand.Type
type Catalog = typeof RemoteAgentCatalog.Type

const BUILTIN_AGENT_COMMANDS = {
  "codex-cli": [
    { name: "help", description: "Show Codex help." },
    { name: "clear", description: "Clear the current conversation." },
    { name: "compact", description: "Compact the current conversation." },
    { name: "status", description: "Show the current Codex status." },
    { name: "model", description: "Select or inspect the current model." },
    { name: "approvals", description: "Inspect approval settings." },
    { name: "sandbox", description: "Inspect sandbox settings." },
    { name: "review", description: "Review the current project changes." },
    { name: "diff", description: "Show the current project diff." },
    { name: "mention", description: "Mention a file or directory in the prompt." },
    { name: "exit", description: "Exit the Codex session." },
  ],
  "opencode-cli": [
    { name: "help", description: "Show OpenCode help." },
    { name: "clear", description: "Clear the current conversation." },
    { name: "compact", description: "Compact the current conversation." },
    { name: "new", description: "Start a new OpenCode session." },
    { name: "agents", description: "List available OpenCode agents." },
    { name: "models", description: "List available OpenCode models." },
    { name: "sessions", description: "List or resume OpenCode sessions." },
    { name: "undo", description: "Undo the latest OpenCode change." },
    { name: "redo", description: "Redo the latest OpenCode change." },
    { name: "share", description: "Share the current OpenCode session." },
    { name: "exit", description: "Exit the OpenCode session." },
  ],
  "claude-code": [
    { name: "help", description: "Show Claude Code help." },
    { name: "clear", description: "Clear the current conversation." },
    { name: "compact", description: "Compact the current conversation." },
    { name: "context", description: "Show the current context usage." },
    { name: "cost", description: "Show session usage and cost." },
    { name: "doctor", description: "Check Claude Code installation health." },
    { name: "init", description: "Initialize project guidance files." },
    { name: "memory", description: "Inspect project memory instructions." },
    { name: "mcp", description: "Manage MCP server connections." },
    { name: "model", description: "Select the current Claude model." },
    { name: "permissions", description: "Inspect permission settings." },
    { name: "review", description: "Review the current project changes." },
    { name: "status", description: "Show Claude Code status." },
    { name: "vim", description: "Toggle Vim editing mode." },
    { name: "exit", description: "Exit the Claude Code session." },
  ],
} as const satisfies { [key in Agent]: readonly Command[] }

type FilesystemError = {
  readonly code?: string
}

type SshAuthority = {
  user: string
  host: string
  port: number
}

const sshScript = [
  "set -eu",
  'dir="$1"',
  'case "$dir" in /*) ;; *) exit 64 ;; esac',
  'if [ ! -d "$dir" ]; then exit 66; fi',
  "printf 'CURRENT\\t%s\\n' \"$dir\"",
  'if [ "$dir" != "/" ]; then',
  "  parent=${dir%/*}",
  '  [ -n "$parent" ] || parent=/',
  "  printf 'PARENT\\t%s\\n' \"$parent\"",
  "fi",
  'for item in "$dir"/* "$dir"/.[!.]* "$dir"/..?*; do',
  '  [ -d "$item" ] || continue',
  "  name=${item##*/}",
  '  [ -n "$name" ] || continue',
  '  printf \'ENTRY\\t%s\\t%s\\n\' "$name" "$item"',
  "done",
].join("\n")

function sshAuthority(value: string, port?: number): SshAuthority | undefined {
  const raw = value.trim()
  if (!raw || raw.length > 320 || /[\u0000-\u001f\u007f;&|$`'"<>()[\]{}*?!~\\]/.test(raw)) return
  const at = raw.indexOf("@")
  if (at < 1 || at !== raw.lastIndexOf("@")) return
  const user = raw.slice(0, at)
  let host = raw.slice(at + 1)
  let embeddedPort: number | undefined
  if (!/^[A-Za-z_][A-Za-z0-9._-]{0,63}$/.test(user)) return
  if (host.startsWith("[")) {
    const close = host.indexOf("]")
    if (close < 0) return
    const suffix = host.slice(close + 1)
    if (suffix && !/^:[1-9][0-9]{0,4}$/.test(suffix)) return
    if (!/^[0-9A-Fa-f:.]+$/.test(host.slice(1, close)) || !host.slice(1, close).includes(":")) return
    embeddedPort = suffix ? Number(suffix.slice(1)) : undefined
    host = host.slice(1, close)
  } else {
    const colons = [...host].filter((character) => character === ":").length
    if (colons > 1) return
    if (colons === 1) {
      const index = host.lastIndexOf(":")
      embeddedPort = Number(host.slice(index + 1))
      if (!Number.isInteger(embeddedPort) || embeddedPort < 1 || embeddedPort > 65_535) return
      host = host.slice(0, index)
    }
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host) || host.includes("..")) return
  }
  const resolvedPort = embeddedPort ?? port ?? 22
  if (!Number.isInteger(resolvedPort) || resolvedPort < 1 || resolvedPort > 65_535) return
  return { user, host, port: resolvedPort }
}

function remotePath(value: string | undefined) {
  const next = value ?? "/"
  if (
    !next.startsWith("/") ||
    next.length > MAX_REMOTE_PATH_LENGTH ||
    next.includes("\\") ||
    next.includes("//") ||
    /[\u0000-\u001f\u007f?#]/.test(next) ||
    next.split("/").some((part) => part === "." || part === "..")
  )
    return
  return next
}

export function buildSshBrowseCommand(authority: string, port: number | undefined, current?: string) {
  const target = sshAuthority(authority, port)
  const folder = remotePath(current)
  if (!target || !folder) return
  const destination = target.host.includes(":") ? `${target.user}@[${target.host}]` : `${target.user}@${target.host}`
  return ChildProcess.make(
    "ssh",
    [
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      `UserKnownHostsFile=${path.join(homedir(), ".ssh", "known_hosts")}`,
      "-o",
      "ConnectTimeout=15",
      "-p",
      String(target.port),
      destination,
      "sh",
      "-se",
      "--",
      "slopcode-ssh-browse",
      folder,
    ],
    { extendEnv: true, stdin: Stream.make(new TextEncoder().encode(sshScript)) },
  )
}

export function parseSshBrowseOutput(value: string, root = "/") {
  const lines = value.split(/\r?\n/)
  const current = lines.find((line) => line.startsWith("CURRENT\t"))?.slice("CURRENT\t".length)
  const parent = lines.find((line) => line.startsWith("PARENT\t"))?.slice("PARENT\t".length)
  if (!current || !remotePath(current) || (!remotePath(parent) && current !== "/")) return
  const entries = lines
    .filter((line) => line.startsWith("ENTRY\t"))
    .flatMap((line) => {
      const fields = line.split("\t")
      if (fields.length !== 3) return []
      const name = fields[1]!
      const entryPath = fields[2]!
      if (!name || name === "." || name === ".." || /[\u0000-\u001f\u007f\\/]/.test(name)) return []
      if (!remotePath(entryPath) || entryPath !== path.posix.join(current, name)) return []
      return [{ name, path: entryPath, type: "directory" as const }]
    })
    .sort(compareEntries)
    .slice(0, MAX_REMOTE_ENTRIES)
  return {
    root,
    current,
    ...(parent && remotePath(parent) ? { parent } : {}),
    entries,
  } satisfies typeof RemoteBrowseResult.Type
}

export const browseSshRemoteFolder = Effect.fn("RemoteRuntime.browseSsh")(function* (input: {
  readonly authority: string
  readonly port?: number
  readonly current?: string
}) {
  const command = buildSshBrowseCommand(input.authority, input.port, input.current)
  if (!command) return yield* new InvalidRequestError({ message: "SSH authority or folder is invalid", field: "path" })
  const process = yield* AppProcess.Service
  const result = yield* process
    .run(command, {
      timeout: SSH_BROWSE_TIMEOUT,
      maxOutputBytes: MAX_SSH_BROWSE_OUTPUT_BYTES,
      maxErrorBytes: 8 * 1024,
    })
    .pipe(
      Effect.catchTag("AppProcessError", () =>
        Effect.fail(new ServiceUnavailableError({ message: "SSH folder browsing failed" })),
      ),
    )
  if (result.exitCode !== 0) return yield* new ServiceUnavailableError({ message: "SSH folder browsing failed" })
  const listing = parseSshBrowseOutput(result.stdout.toString("utf8"))
  if (!listing) return yield* new ServiceUnavailableError({ message: "SSH folder browser returned invalid metadata" })
  return listing
})

function isFilesystemError(error: unknown): error is FilesystemError {
  return typeof error === "object" && error !== null && ("code" in error ? typeof error.code === "string" : true)
}

function filesystemError(error: unknown, message: string) {
  if (isFilesystemError(error) && error.code === "ENOENT")
    return new ApiNotFoundError({ name: "NotFoundError", data: { message } })
  if (isFilesystemError(error) && (error.code === "EACCES" || error.code === "EPERM" || error.code === "ELOOP")) {
    return new ForbiddenError({ message })
  }
  return new ServiceUnavailableError({ message })
}

function isWithin(root: string, candidate: string) {
  const relative = path.posix.relative(root, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.posix.isAbsolute(relative))
}

function compareEntries(left: Entry, right: Entry) {
  const rank = ENTRY_TYPE_RANK[left.type] - ENTRY_TYPE_RANK[right.type]
  if (rank !== 0) return rank
  if (left.name < right.name) return -1
  if (left.name > right.name) return 1
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

function boundedOutput(stdout: Uint8Array, stderr: Uint8Array) {
  const output = Buffer.concat([stdout, stderr]).subarray(0, MAX_CODEX_OUTPUT_BYTES)
  return output.toString("utf8")
}

function agentCommand(agent: Agent, prompt: string, config?: Config) {
  const executable = AGENT_EXECUTABLES[agent]
  const command = AGENT_COMMANDS[agent]
  if (!executable || !command) return undefined
  const args: Array<string> = [command]
  if (agent === "opencode-cli") {
    if (config?.sandbox || config?.approval) return undefined
    if (config?.model) args.push("--model", config.model)
    if (config?.profile) args.push("--agent", config.profile)
    args.push("--", prompt)
    return { executable, args }
  }
  if (agent === "claude-code") {
    if (config?.profile || config?.sandbox || config?.approval) return undefined
    if (config?.model) args.push("--model", config.model)
    if (config?.permissionMode) args.push("--permission-mode", config.permissionMode)
    args.push("--", prompt)
    return { executable, args }
  }
  if (config?.model) args.push("--model", config.model)
  if (config?.profile) args.push("--profile", config.profile)
  if (config?.sandbox) args.push("--sandbox", config.sandbox)
  if (config?.approval) args.push("--ask-for-approval", config.approval)
  args.push("--", prompt)
  return { executable, args }
}

function timedOut(error: AppProcess.AppProcessError) {
  return error.message.includes("Timed out") || String(error.cause ?? "").includes("Timed out")
}

export const buildAgentCommand = agentCommand

export function buildAgentVersionCommand(agent: Agent, directory: string) {
  const executable = AGENT_EXECUTABLES[agent]
  if (!executable) return
  return ChildProcess.make(executable, ["--version"], {
    cwd: directory,
    extendEnv: true,
    env: { SLOPCODE_REMOTE_SUPERVISOR_TOKEN: undefined },
    stdin: "ignore",
    forceKillAfter: CODEX_FORCE_KILL_AFTER,
  })
}

function parseAgentVersion(result: AppProcess.RunResult) {
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated) return
  const output = (result.stdout.byteLength > 0 ? result.stdout : result.stderr).toString("utf8").trim()
  if (
    !output ||
    Buffer.byteLength(output) > MAX_REMOTE_AGENT_VERSION_LENGTH ||
    output.length > MAX_REMOTE_AGENT_VERSION_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(output)
  )
    return
  return output
}

export const runAgentVersion = Effect.fn("RemoteRuntime.agentVersion")(function* (input: {
  readonly agent: Agent
  readonly directory: string
}) {
  const process = yield* AppProcess.Service
  const command = buildAgentVersionCommand(input.agent, input.directory)
  if (!command) return yield* new InvalidRequestError({ message: "unsupported agent", field: "agent" })
  const result = yield* process
    .run(command, {
      timeout: REMOTE_AGENT_VERSION_TIMEOUT,
      maxOutputBytes: MAX_REMOTE_AGENT_VERSION_OUTPUT_BYTES,
      maxErrorBytes: MAX_REMOTE_AGENT_VERSION_OUTPUT_BYTES,
    })
    .pipe(
      Effect.catchTag("AppProcessError", () =>
        Effect.fail(new ServiceUnavailableError({ message: "remote agent version check failed" })),
      ),
    )
  const version = parseAgentVersion(result)
  if (!version) return yield* new ServiceUnavailableError({ message: "remote agent returned invalid version metadata" })
  return version
})

function commandName(value: string) {
  const name = value.trim()
  if (
    !name ||
    name.length > MAX_REMOTE_AGENT_COMMAND_NAME_LENGTH ||
    Buffer.byteLength(name) > MAX_REMOTE_AGENT_COMMAND_NAME_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(name)
  )
    return
  return name
}

function metadataText(value: string, limit: number) {
  let text = value.trim()
  if (!text || text === "|" || text === ">") return
  if (text.startsWith('"') || text.startsWith("'")) {
    if (text.length < 2 || text.at(-1) !== text[0]) return
    if (text[0] === '"') {
      try {
        const parsed: unknown = JSON.parse(text)
        if (typeof parsed !== "string") return
        text = parsed
      } catch {
        return
      }
    } else {
      text = text.slice(1, -1).replaceAll("''", "'")
    }
  }
  if (!text || text.length > limit || Buffer.byteLength(text) > limit || /[\u0000-\u001f\u007f]/.test(text)) return
  return text
}

function frontmatter(content: string) {
  const lines = content.split(/\r?\n/)
  if (lines[0] !== "---") return {}
  const end = lines.findIndex((line, index) => index > 0 && line === "---")
  if (end < 0 || Buffer.byteLength(lines.slice(0, end + 1).join("\n")) > MAX_REMOTE_AGENT_METADATA_BYTES) return
  const metadata: {
    description?: string
    agent?: string
    model?: string
    subtask?: boolean
  } = {}
  const seen = new Set<string>()
  for (const line of lines.slice(1, end)) {
    const value = line.trim()
    if (!value || value.startsWith("#")) continue
    const match = value.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/)
    if (!match) return
    const key = match[1]!
    if (seen.has(key)) return
    seen.add(key)
    if (key === "description" || key === "agent" || key === "model") {
      const parsed = metadataText(
        match[2]!,
        key === "description" ? MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH : MAX_REMOTE_AGENT_COMMAND_VALUE_LENGTH,
      )
      if (!parsed) return
      metadata[key] = parsed
      continue
    }
    if (key === "subtask") {
      if (match[2] !== "true" && match[2] !== "false") return
      metadata.subtask = match[2] === "true"
    }
  }
  return metadata
}

export function parseRemoteCommandMetadata(filename: string, content: string) {
  const name = commandName(path.basename(filename).replace(/\.md$/i, ""))
  if (!name || (Buffer.byteLength(content) > MAX_REMOTE_AGENT_METADATA_BYTES && content.startsWith("---"))) return
  const data = frontmatter(content)
  if (data === undefined) return
  return { name, ...data } satisfies Command
}

async function readCommandMetadata(file: string) {
  const handle = await open(file, "r")
  try {
    const buffer = Buffer.alloc(MAX_REMOTE_AGENT_METADATA_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return parseRemoteCommandMetadata(file, buffer.subarray(0, bytesRead).toString("utf8"))
  } finally {
    await handle.close()
  }
}

async function commandFiles(root: string, directory: string, files: string[], depth = 0): Promise<void> {
  if (depth > MAX_REMOTE_AGENT_COMMAND_DEPTH || files.length >= MAX_REMOTE_AGENT_DISCOVERY_FILES) return
  const resolved = await realpath(directory).catch(() => undefined)
  if (!resolved || !isWithin(root, resolved)) return
  const entries = await opendir(resolved).catch(() => undefined)
  if (!entries) return
  for await (const entry of entries) {
    if (files.length >= MAX_REMOTE_AGENT_DISCOVERY_FILES) break
    if (!entry.name || entry.name === "." || entry.name === ".." || /[\u0000-\u001f\u007f/\\]/.test(entry.name))
      continue
    const item = path.join(resolved, entry.name)
    if (entry.isDirectory()) {
      await commandFiles(root, item, files, depth + 1)
      continue
    }
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue
    const target = await realpath(item).catch(() => undefined)
    if (target && isWithin(root, target)) files.push(target)
  }
}

export async function discoverRemoteCommands(agent: Agent, directory: string) {
  const root = await realpath(directory).catch(() => undefined)
  if (!root) return []
  const files: string[] = []
  for (const relative of AGENT_COMMAND_DIRECTORIES[agent]) {
    await commandFiles(root, path.join(root, relative), files)
    if (files.length >= MAX_REMOTE_AGENT_DISCOVERY_FILES) break
  }
  files.sort()
  const commands: Command[] = []
  for (const file of files.slice(0, MAX_REMOTE_AGENT_DISCOVERY_FILES)) {
    const command = await readCommandMetadata(file).catch(() => undefined)
    if (command) commands.push(command)
  }
  return commands
}

function catalog(agent: Agent, version: string, custom: readonly Command[]): Catalog {
  const commands = new Map<string, Command>()
  BUILTIN_AGENT_COMMANDS[agent].forEach((command) => commands.set(command.name, command))
  custom.forEach((command) => commands.set(command.name, command))
  const result = Array.from(commands.values()).slice(0, MAX_REMOTE_AGENT_COMMANDS)
  while (
    result.length > 0 &&
    Buffer.byteLength(JSON.stringify({ agent, version, commands: result })) > MAX_REMOTE_AGENT_CATALOG_BYTES
  ) {
    result.pop()
  }
  return { agent, version, commands: result }
}

export const runAgentCatalog = Effect.fn("RemoteRuntime.agentCatalog")(function* (input: {
  readonly agent: Agent
  readonly directory: string
}) {
  const version = yield* runAgentVersion(input)
  const custom = yield* Effect.tryPromise({
    try: () => discoverRemoteCommands(input.agent, input.directory),
    catch: () => new Error("remote command discovery failed"),
  }).pipe(Effect.catch(() => Effect.succeed([] as Command[])))
  return catalog(input.agent, version, custom)
})

export const runAgentPrompt = Effect.fn("RemoteRuntime.agentPrompt")(function* (input: {
  readonly agent: Agent
  readonly directory: string
  readonly prompt: string
  readonly config?: Config
}) {
  const process = yield* AppProcess.Service
  const selected = agentCommand(input.agent, input.prompt, input.config)
  if (!selected) {
    return yield* new InvalidRequestError({
      message:
        input.agent === "opencode-cli"
          ? "unsupported OpenCode configuration"
          : input.agent === "claude-code"
            ? "unsupported Claude Code configuration"
            : "unsupported agent",
      field: input.agent === "opencode-cli" || input.agent === "claude-code" ? "config" : "agent",
    })
  }
  const command = ChildProcess.make(selected.executable, selected.args, {
    cwd: input.directory,
    extendEnv: true,
    env: { SLOPCODE_REMOTE_SUPERVISOR_TOKEN: undefined },
    stdin: "ignore",
    forceKillAfter: CODEX_FORCE_KILL_AFTER,
  })
  return yield* process
    .run(command, {
      timeout: CODEX_TIMEOUT,
      maxOutputBytes: MAX_CODEX_OUTPUT_BYTES,
      maxErrorBytes: MAX_CODEX_OUTPUT_BYTES,
    })
    .pipe(
      Effect.map((result) => ({
        output: boundedOutput(result.stdout, result.stderr),
        status: result.exitCode === 0 ? ("completed" as const) : ("failed" as const),
        exitCode: result.exitCode,
      })),
      Effect.catchTag("AppProcessError", (error) =>
        Effect.succeed({
          output: boundedOutput(Buffer.from(error.stderr ?? ""), Buffer.alloc(0)),
          status: timedOut(error) ? ("timed_out" as const) : ("failed" as const),
          ...(error.exitCode === undefined ? {} : { exitCode: error.exitCode }),
        }),
      ),
    )
})

async function listEntries(root: string, current: string) {
  const entries: Array<Entry> = []
  const directory = await opendir(current)
  for await (const entry of directory) {
    if (entry.name.length > MAX_REMOTE_ENTRY_NAME_LENGTH) continue
    const entryPath = path.posix.join(current, entry.name)
    if (Buffer.byteLength(entryPath) > MAX_REMOTE_PATH_LENGTH) continue
    const target = await realpath(entryPath).catch(() => undefined)
    if (!target || !isWithin(root, target)) continue
    const type = entry.isDirectory()
      ? "directory"
      : entry.isFile()
        ? "file"
        : entry.isSymbolicLink()
          ? "symlink"
          : "other"
    const next = { name: entry.name, path: entryPath, type } satisfies Entry
    entries.push(next)
    entries.sort(compareEntries)
    if (entries.length > MAX_REMOTE_ENTRIES) entries.pop()
  }
  return entries
}

export const browseRemoteFolder = Effect.fn("RemoteRuntime.browse")(function* (input: {
  readonly root: string
  readonly current: string
}) {
  const resolved = yield* resolveRemoteFolder(input)
  const entries = yield* Effect.tryPromise({
    try: () => listEntries(resolved.root, resolved.current),
    catch: (error) => filesystemError(error, "the requested folder is unavailable"),
  })
  const parent = resolved.current === resolved.root ? undefined : path.posix.dirname(resolved.current)
  return {
    root: resolved.root,
    current: resolved.current,
    ...(parent && isWithin(resolved.root, parent) ? { parent } : {}),
    entries,
  } satisfies typeof RemoteBrowseResult.Type
})

export const resolveRemoteFolder = Effect.fn("RemoteRuntime.resolveFolder")(function* (input: {
  readonly root: string
  readonly current: string
}) {
  if (!path.posix.isAbsolute(input.current) || input.current.includes("\0")) {
    return yield* new InvalidRequestError({ message: "path must be an absolute POSIX path", field: "path" })
  }
  if (Buffer.byteLength(input.current) > MAX_REMOTE_PATH_LENGTH) {
    return yield* new InvalidRequestError({ message: "path is too long", field: "path" })
  }

  const root = yield* Effect.tryPromise({
    try: () => realpath(input.root),
    catch: (error) => filesystemError(error, "the instance directory is unavailable"),
  })
  const current = yield* Effect.tryPromise({
    try: () => realpath(input.current),
    catch: (error) => filesystemError(error, "the requested folder is unavailable"),
  })
  if (!isWithin(root, current)) return yield* new ForbiddenError({ message: "path is outside the instance directory" })

  const info = yield* Effect.tryPromise({
    try: () => lstat(current),
    catch: (error) => filesystemError(error, "the requested folder is unavailable"),
  })
  if (!info.isDirectory())
    return yield* new ApiNotFoundError({ name: "NotFoundError", data: { message: "folder not found" } })
  if (Buffer.byteLength(root) > MAX_REMOTE_PATH_LENGTH || Buffer.byteLength(current) > MAX_REMOTE_PATH_LENGTH) {
    return yield* new ServiceUnavailableError({ message: "folder path is too long" })
  }
  return { root, current }
})

export const remoteRuntimeHandlers = HttpApiBuilder.group(InstanceHttpApi, "remote-runtime", (handlers) =>
  Effect.gen(function* () {
    const browse = Effect.fn("RemoteRuntimeHttpApi.browse")(function* (ctx: {
      query: { path?: string; sshAuthority?: string; sshPort?: number }
    }) {
      if (ctx.query.sshAuthority) {
        return yield* browseSshRemoteFolder({
          authority: ctx.query.sshAuthority,
          port: ctx.query.sshPort,
          current: ctx.query.path,
        })
      }
      const instance = yield* InstanceRef
      if (!instance) return yield* new ServiceUnavailableError({ message: "instance context unavailable" })
      return yield* browseRemoteFolder({ root: instance.directory, current: ctx.query.path ?? instance.directory })
    })

    const prompt = Effect.fn("RemoteRuntimeHttpApi.prompt")(function* (ctx: {
      query: typeof RemoteAgentPromptQuery.Type
      payload: RemoteAgentPrompt
    }) {
      const instance = yield* InstanceRef
      if (!instance) return yield* new ServiceUnavailableError({ message: "instance context unavailable" })
      const folder = yield* resolveRemoteFolder({
        root: instance.directory,
        current: ctx.query.path ?? instance.directory,
      })
      return yield* runAgentPrompt({
        agent: ctx.payload.agent,
        directory: folder.current,
        prompt: ctx.payload.prompt,
        config: ctx.payload.config,
      })
    })

    const catalog = Effect.fn("RemoteRuntimeHttpApi.catalog")(function* (ctx: {
      query: typeof RemoteAgentCatalogQuery.Type
    }) {
      const instance = yield* InstanceRef
      if (!instance) return yield* new ServiceUnavailableError({ message: "instance context unavailable" })
      const folder = yield* resolveRemoteFolder({
        root: instance.directory,
        current: ctx.query.path ?? instance.directory,
      })
      return yield* runAgentCatalog({ agent: ctx.query.agent, directory: folder.current })
    })

    return handlers.handle("browse", browse).handle("prompt", prompt).handle("catalog", catalog)
  }),
)
