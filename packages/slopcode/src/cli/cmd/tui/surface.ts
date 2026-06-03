import z from "zod"
import { Config } from "@/config/config"
import { Keybind } from "@/util/keybind"
import type { SessionStatus } from "@/session/status"
import type { Session } from "@/session"
import type { MessageV2 } from "@/session/message-v2"

export const TUI_SURFACE_VERSION = 2

export const TuiSurfaceCommand = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string().optional(),
  slash: z
    .object({
      name: z.string(),
      aliases: z.string().array().optional(),
      usage: z.string().optional(),
    })
    .optional(),
  keybind: z.string().optional(),
  capability: z.string().optional(),
})
export type TuiSurfaceCommand = z.infer<typeof TuiSurfaceCommand>

export const TuiSurfaceManifest = z.object({
  version: z.literal(TUI_SURFACE_VERSION),
  renderer: z.object({
    linux: z.literal("opentui/solid"),
    android: z.literal("ratatui/crossterm"),
    frame: z.literal("shared/terminal-frame"),
  }),
  capabilities: z.record(z.string(), z.boolean()),
  commands: TuiSurfaceCommand.array(),
  keybinds: z.record(z.string(), z.string()),
  prompt: z.object({
    maxHeight: z.number(),
    supportsFileParts: z.boolean(),
    supportsShellMode: z.boolean(),
    supportsHistory: z.boolean(),
    supportsStash: z.boolean(),
    supportsQueue: z.boolean(),
  }),
})
export type TuiSurfaceManifest = z.infer<typeof TuiSurfaceManifest>

export const TuiSurfaceAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    command: z.string(),
    value: z.string().optional(),
    sessionID: z.string().optional(),
  }),
  z.object({
    type: z.literal("prompt.submit"),
    sessionID: z.string().optional(),
    text: z.string(),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    agent: z.string().optional(),
    parts: z.any().array().optional(),
  }),
  z.object({
    type: z.literal("session.select"),
    sessionID: z.string(),
  }),
  z.object({
    type: z.literal("permission.reply"),
    sessionID: z.string(),
    requestID: z.string(),
    reply: z.enum(["once", "always", "reject"]),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("question.reply"),
    sessionID: z.string(),
    questionID: z.string(),
    answers: z.any().array(),
  }),
  z.object({
    type: z.literal("editor.input"),
    sessionID: z.string(),
    editorID: z.string(),
    keys: z.string(),
  }),
  z.object({
    type: z.literal("editor.save"),
    sessionID: z.string(),
    editorID: z.string(),
  }),
  z.object({
    type: z.literal("editor.dismissDiff"),
    sessionID: z.string(),
    editorID: z.string(),
  }),
])
export type TuiSurfaceAction = z.infer<typeof TuiSurfaceAction>

export const TuiSurfaceSnapshot = z.object({
  version: z.literal(TUI_SURFACE_VERSION),
  sessionID: z.string().optional(),
  title: z.string(),
  status: z.string(),
  header: z.object({
    title: z.string(),
    context: z.string().optional(),
    cost: z.string().optional(),
  }),
  footer: z.object({
    directory: z.string(),
    version: z.string().optional(),
    workspaceID: z.string().optional(),
    lsp: z.number(),
    mcp: z.number(),
    mcpFailed: z.boolean(),
    permissions: z.number(),
  }),
  tabs: z
    .object({
      id: z.string(),
      title: z.string(),
      active: z.boolean(),
      status: z.string(),
    })
    .array(),
  transcript: z
    .object({
      id: z.string(),
      role: z.string(),
      text: z.string().optional(),
      tools: z
        .object({
          id: z.string(),
          tool: z.string(),
          status: z.string(),
          preview: z.string().array(),
          diff: z.string().array(),
          expandable: z.boolean(),
        })
        .array(),
    })
    .array(),
  sidebar: z.object({
    mode: z.enum(["summary", "files"]).optional(),
    rows: z.string().array(),
  }),
})
export type TuiSurfaceSnapshot = z.infer<typeof TuiSurfaceSnapshot>

export const TuiSurfaceFrameStyle = z.object({
  fg: z.string().optional(),
  bg: z.string().optional(),
  bold: z.boolean().optional(),
  dim: z.boolean().optional(),
  underline: z.boolean().optional(),
  reverse: z.boolean().optional(),
})
export type TuiSurfaceFrameStyle = z.infer<typeof TuiSurfaceFrameStyle>

export const TuiSurfaceFrameSpan = z.object({
  x: z.number(),
  text: z.string(),
  style: TuiSurfaceFrameStyle.optional(),
})
export type TuiSurfaceFrameSpan = z.infer<typeof TuiSurfaceFrameSpan>

export const TuiSurfaceFrame = z.object({
  version: z.literal(TUI_SURFACE_VERSION),
  renderer: z.literal("shared/terminal-frame"),
  width: z.number(),
  height: z.number(),
  sessionID: z.string().optional(),
  title: z.string(),
  status: z.string(),
  lines: z.string().array(),
  rows: z
    .object({
      y: z.number(),
      spans: TuiSurfaceFrameSpan.array(),
    })
    .array(),
})
export type TuiSurfaceFrame = z.infer<typeof TuiSurfaceFrame>

type ManifestInput = {
  keybinds?: Record<string, string | undefined>
  android?: boolean
}

function runtimeVersion() {
  const globalVersion = (globalThis as { SLOPCODE_VERSION?: unknown }).SLOPCODE_VERSION
  if (typeof globalVersion === "string") return globalVersion
  return process.env.SLOPCODE_VERSION ?? "local"
}

const command = (input: TuiSurfaceCommand): TuiSurfaceCommand => input

export const surfaceCommands = [
  command({
    id: "help.show",
    title: "Help",
    category: "System",
    description: "Show help and available commands",
    slash: { name: "help", aliases: ["commands"] },
    keybind: "command_list",
  }),
  command({
    id: "session.new",
    title: "New Session",
    category: "Session",
    slash: { name: "new" },
    keybind: "session_new",
  }),
  command({
    id: "session.list",
    title: "Sessions",
    category: "Session",
    slash: { name: "sessions", aliases: ["session"] },
    keybind: "session_list",
  }),
  command({
    id: "session.tabs",
    title: "Tabs",
    category: "Session",
    slash: { name: "tabs" },
    keybind: "session_tabs_next",
  }),
  command({
    id: "session.children",
    title: "Child Sessions",
    category: "Session",
    slash: { name: "children" },
    keybind: "session_child_first",
  }),
  command({
    id: "session.timeline",
    title: "Timeline",
    category: "Session",
    slash: { name: "timeline", aliases: ["messages"] },
    keybind: "session_timeline",
  }),
  command({
    id: "session.status",
    title: "Status",
    category: "Session",
    slash: { name: "status" },
    keybind: "status_view",
  }),
  command({
    id: "session.share",
    title: "Share",
    category: "Session",
    slash: { name: "share" },
    keybind: "session_share",
  }),
  command({
    id: "session.unshare",
    title: "Unshare",
    category: "Session",
    slash: { name: "unshare" },
    keybind: "session_unshare",
  }),
  command({
    id: "session.compact",
    title: "Compact",
    category: "Session",
    slash: { name: "compact" },
    keybind: "session_compact",
  }),
  command({
    id: "session.interrupt",
    title: "Interrupt",
    category: "Session",
    slash: { name: "interrupt", aliases: ["abort"] },
    keybind: "session_interrupt",
  }),
  command({
    id: "session.fork",
    title: "Fork",
    category: "Session",
    slash: { name: "fork" },
    keybind: "session_fork",
  }),
  command({
    id: "session.close",
    title: "Close Tab",
    category: "Session",
    slash: { name: "close" },
  }),
  command({
    id: "session.pause",
    title: "Pause",
    category: "Session",
    slash: { name: "pause" },
  }),
  command({
    id: "session.resume",
    title: "Resume",
    category: "Session",
    slash: { name: "resume" },
  }),
  command({
    id: "session.revert",
    title: "Revert",
    category: "Session",
    slash: { name: "revert", usage: "/revert <message-id>" },
    keybind: "messages_undo",
  }),
  command({
    id: "session.unrevert",
    title: "Unrevert",
    category: "Session",
    slash: { name: "unrevert" },
    keybind: "messages_redo",
  }),
  command({
    id: "session.title",
    title: "Rename",
    category: "Session",
    slash: { name: "title", usage: "/title <title>" },
    keybind: "session_rename",
  }),
  command({
    id: "model.list",
    title: "Models",
    category: "Agent",
    slash: { name: "models", aliases: ["model"] },
    keybind: "model_list",
  }),
  command({
    id: "provider.list",
    title: "Providers",
    category: "Agent",
    slash: { name: "providers", aliases: ["connect"] },
  }),
  command({
    id: "agent.list",
    title: "Agents",
    category: "Agent",
    slash: { name: "agents", aliases: ["agent"] },
    keybind: "agent_list",
  }),
  command({
    id: "sidebar.summary",
    title: "Modified Files",
    category: "Workspace",
    slash: { name: "summary", aliases: ["sidebar"] },
    keybind: "sidebar_toggle",
  }),
  command({
    id: "sidebar.files",
    title: "Files",
    category: "Workspace",
    slash: { name: "files" },
    keybind: "session_files",
  }),
  command({
    id: "file.open",
    title: "Open File",
    category: "Workspace",
    slash: { name: "open", usage: "/open <file>" },
  }),
  command({
    id: "file.attach",
    title: "Attach File",
    category: "Workspace",
    slash: { name: "attach", usage: "/attach <file>" },
  }),
  command({
    id: "editor.focus",
    title: "Edit",
    category: "Editor",
    slash: { name: "edit" },
    keybind: "editor_open",
  }),
  command({
    id: "editor.save",
    title: "Save Editor",
    category: "Editor",
    slash: { name: "save" },
  }),
  command({
    id: "editor.diagnostics",
    title: "Diagnostics",
    category: "Editor",
    slash: { name: "diagnostics" },
  }),
  command({
    id: "editor.diff",
    title: "Diff",
    category: "Editor",
    slash: { name: "diff", usage: "/diff [dismiss]" },
  }),
  command({
    id: "editor.close",
    title: "Close Editor",
    category: "Editor",
    slash: { name: "close-editor", aliases: ["close-editor!"] },
  }),
  command({
    id: "prompt.queue",
    title: "Prompt Queue",
    category: "Prompt",
    slash: { name: "queue" },
  }),
  command({
    id: "prompt.stash",
    title: "Prompt Stash",
    category: "Prompt",
    slash: { name: "stash", aliases: ["list", "pop"] },
  }),
  command({
    id: "prompt.shell",
    title: "Shell Mode",
    category: "Prompt",
    slash: { name: "shell" },
  }),
  command({
    id: "theme.list",
    title: "Themes",
    category: "System",
    slash: { name: "themes" },
    keybind: "theme_list",
  }),
  command({
    id: "terminal.suspend",
    title: "Suspend",
    category: "System",
    slash: { name: "suspend" },
    keybind: "terminal_suspend",
  }),
  command({
    id: "keybinds.list",
    title: "Keybinds",
    category: "System",
    slash: { name: "keybinds" },
  }),
  command({
    id: "clipboard.status",
    title: "Clipboard",
    category: "System",
    slash: { name: "clipboard" },
    capability: "clipboard",
  }),
  command({
    id: "plugins.list",
    title: "Plugins",
    category: "System",
    slash: { name: "plugins", aliases: ["mcps"] },
    keybind: "plugin_manager",
    capability: "plugins.declarative",
  }),
  command({
    id: "android.doctor",
    title: "Android Runtime",
    category: "System",
    slash: { name: "doctor" },
    capability: "android.runtime",
  }),
] as const satisfies readonly TuiSurfaceCommand[]

export function createSurfaceManifest(input: ManifestInput = {}): TuiSurfaceManifest {
  const keybinds = Config.Keybinds.parse(input.keybinds ?? {}) as Record<string, string>
  return {
    version: TUI_SURFACE_VERSION,
    renderer: {
      linux: "opentui/solid",
      android: "ratatui/crossterm",
      frame: "shared/terminal-frame",
    },
    capabilities: {
      "android.runtime": input.android ?? false,
      clipboard: true,
      editor: true,
      "editor.websocket": true,
      "files.sidebar": true,
      "permissions.multi": true,
      "plugins.declarative": true,
      "prompt.fileParts": true,
      "prompt.history": true,
      "prompt.queue": true,
      "prompt.shell": true,
      "prompt.stash": true,
      "session.tabs": true,
      "terminal.mouse": !input.android,
      "theme.switcher": !input.android,
    },
    commands: [...surfaceCommands],
    keybinds,
    prompt: {
      maxHeight: 6,
      supportsFileParts: true,
      supportsShellMode: true,
      supportsHistory: true,
      supportsStash: true,
      supportsQueue: true,
    },
  }
}

export function commandSlashNames(manifest: Pick<TuiSurfaceManifest, "commands">) {
  return manifest.commands.flatMap((item) => {
    if (!item.slash) return []
    return [item.slash.name, ...(item.slash.aliases ?? [])]
  })
}

export function commandRows(manifest: Pick<TuiSurfaceManifest, "commands" | "keybinds">, query = "") {
  const needle = query.trim().toLowerCase()
  const rows = manifest.commands
    .filter((item) => {
      if (!needle) return true
      return (
        item.id.toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle) ||
        item.slash?.name.toLowerCase().includes(needle) ||
        item.slash?.aliases?.some((alias) => alias.toLowerCase().includes(needle))
      )
    })
    .map((item) => {
      const slash = item.slash ? `/${item.slash.name}` : item.id
      const aliases = item.slash?.aliases?.length
        ? ` (${item.slash.aliases.map((alias) => `/${alias}`).join(", ")})`
        : ""
      const key = item.keybind ? manifest.keybinds[item.keybind] : undefined
      return `${item.category}: ${slash}${aliases}  ${item.title}${key && key !== "none" ? `  ${Keybind.toString(Keybind.parse(key)[0])}` : ""}`
    })
  return rows.length ? rows : [`No commands match ${query}`]
}

function stringify(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value == null) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function partText(part: MessageV2.Part) {
  if (part.type === "text" || part.type === "reasoning") return part.text
  if (part.type === "file") return part.url
  return ""
}

function toolPreview(part: MessageV2.ToolPart) {
  const output = stringify((part.state as { output?: unknown }).output)
  return output
    .split("\n")
    .map((item) => item.trimEnd())
    .filter(Boolean)
    .slice(0, 8)
}

function toolDiff(part: MessageV2.ToolPart) {
  const state = part.state as { input?: Record<string, unknown> }
  const diff = stringify(part.metadata?.diff ?? state.input?.diff)
  if (!diff) return []
  return diff
    .split("\n")
    .filter((line) => {
      return (
        line.startsWith("diff --git") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("@@") ||
        (line.startsWith("+") && !line.startsWith("+++")) ||
        (line.startsWith("-") && !line.startsWith("---"))
      )
    })
    .slice(0, 14)
}

function statusLabel(status?: SessionStatus.Info) {
  if (!status) return "idle"
  if (status.type === "busy") return status.phase
  if (status.type === "retry") return `retry ${status.attempt}`
  return status.type
}

export function createSurfaceSnapshot(input: {
  directory: string
  session?: Session.Info
  sessions?: Session.Info[]
  status?: Record<string, SessionStatus.Info>
  messages?: MessageV2.Info[]
  chunks?: MessageV2.PartChunk[]
  files?: { path: string; status: string; added?: number; removed?: number }[]
  lsp?: unknown[]
  mcp?: Record<string, { status?: string }>
  permissions?: number
}): TuiSurfaceSnapshot {
  const sessionID = input.session?.id
  const chunks = new Map((input.chunks ?? []).map((item) => [item.messageID, item.parts]))
  const messages = (input.messages ?? []).slice().reverse()
  const status = sessionID ? input.status?.[sessionID] : undefined
  const mcp = Object.values(input.mcp ?? {})
  return {
    version: TUI_SURFACE_VERSION,
    sessionID,
    title: input.session?.title ?? "SlopCode",
    status: statusLabel(status),
    header: {
      title: input.session?.title ?? "SlopCode",
    },
    footer: {
      directory: input.directory,
      version: runtimeVersion(),
      workspaceID: input.session?.workspaceID,
      lsp: input.lsp?.length ?? 0,
      mcp: mcp.filter((item) => item.status === "connected").length,
      mcpFailed: mcp.some((item) => item.status === "failed" || item.status === "error"),
      permissions: input.permissions ?? 0,
    },
    tabs: (input.sessions ?? (input.session ? [input.session] : [])).slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      active: item.id === sessionID,
      status: statusLabel(input.status?.[item.id]),
    })),
    transcript: messages.map((message) => {
      const parts = chunks.get(message.id) ?? []
      const text = parts.map(partText).filter(Boolean).join("\n")
      const tools = parts.flatMap((part) => {
        if (part.type !== "tool") return []
        const status = stringify(part.state.status || "pending")
        const preview = toolPreview(part)
        const diff = toolDiff(part)
        return [
          {
            id: part.id,
            tool: part.tool,
            status,
            preview,
            diff,
            expandable: preview.length >= 8 || diff.length >= 14,
          },
        ]
      })
      return {
        id: message.id,
        role: message.role,
        text,
        tools,
      }
    }),
    sidebar: {
      mode: "summary",
      rows:
        input.files?.map(
          (item) =>
            `${item.status.padStart(8)} ${item.path}${item.added || item.removed ? ` +${item.added ?? 0}/-${item.removed ?? 0}` : ""}`,
        ) ?? [],
    },
  }
}

function cellWidth(char: string) {
  const code = char.codePointAt(0) ?? 0
  if (code === 0) return 0
  if (code < 0x20 || (code >= 0x7f && code < 0xa0)) return 0
  return code >= 0x1100 ? 2 : 1
}

function visibleWidth(text: string) {
  let width = 0
  for (const char of text) width += cellWidth(char)
  return width
}

function fit(text: string, width: number) {
  if (width <= 0) return ""
  let out = ""
  let size = 0
  for (const char of text.replace(/\s+/g, " ")) {
    const next = cellWidth(char)
    if (size + next > width) break
    out += char
    size += next
  }
  return out + " ".repeat(Math.max(0, width - size))
}

function fitRaw(text: string, width: number) {
  if (width <= 0) return ""
  let out = ""
  let size = 0
  for (const char of text) {
    const next = cellWidth(char)
    if (size + next > width) break
    out += char
    size += next
  }
  return out + " ".repeat(Math.max(0, width - size))
}

function wrap(text: string, width: number) {
  if (width <= 0) return [""]
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (visibleWidth(candidate) <= width) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (visibleWidth(word) <= width) {
      line = word
      continue
    }
    let chunk = ""
    let size = 0
    for (const char of word) {
      const next = cellWidth(char)
      if (size + next > width) {
        lines.push(chunk)
        chunk = ""
        size = 0
      }
      chunk += char
      size += next
    }
    line = chunk
  }
  if (line) lines.push(line)
  return lines
}

function clampDimension(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

const logoLines = [
  "                                  ",
  "█▀▀ █   █▀█ █▀█  █▀▀ █▀█ █▀▄ █▀▀",
  "▀▀█ █   █ █ █▀▀  █   █ █ █ █ █▀▀",
  "▀▀▀ ▀▀▀ ▀▀▀ ▀    ▀▀▀ ▀▀▀ ▀▀  ▀▀▀",
]

function center(text: string, width: number) {
  const left = Math.max(0, Math.floor((width - visibleWidth(text)) / 2))
  return fitRaw(`${" ".repeat(left)}${text}`, width)
}

function tabLine(snapshot: TuiSurfaceSnapshot) {
  const tabs = snapshot.tabs.length
    ? snapshot.tabs.map((item) => `${item.active ? "[*]" : "[ ]"} ${item.title} ${item.status}`).join("  ")
    : "[ ] new session idle"
  return tabs
}

function transcriptLines(snapshot: TuiSurfaceSnapshot, width: number) {
  const lines: string[] = []
  if (snapshot.transcript.length === 0) {
    lines.push("Start a conversation or type /help for commands.")
    return lines
  }
  for (const message of snapshot.transcript) {
    const label = message.role === "user" ? "You" : "Assistant"
    if (message.text) lines.push(...wrap(`${label}: ${message.text}`, width))
    for (const tool of message.tools) {
      lines.push(...wrap(`tool ${tool.tool} ${tool.status}`, width))
      for (const row of tool.preview) lines.push(...wrap(`output ${row}`, width))
      for (const row of tool.diff) lines.push(...wrap(`diff ${row}`, width))
      if (tool.expandable) lines.push("more output available")
    }
    if (message.text || message.tools.length > 0) lines.push("")
  }
  while (lines.at(-1) === "") lines.pop()
  return lines.length ? lines : ["No transcript yet."]
}

function sidebarLines(snapshot: TuiSurfaceSnapshot, width: number) {
  const title = snapshot.sidebar.mode === "files" ? "Files" : "Modified Files"
  const rows = snapshot.sidebar.rows.length ? snapshot.sidebar.rows : ["No changed files"]
  return [title, ...rows.flatMap((row) => wrap(row, width))]
}

function homeLines(snapshot: TuiSurfaceSnapshot, width: number, height: number) {
  const lines = Array.from({ length: height }, () => " ".repeat(width))
  const logoStart = Math.max(1, Math.floor((height - 8) / 2))
  for (const [index, line] of logoLines.entries()) {
    if (logoStart + index >= height) break
    lines[logoStart + index] = center(line, width)
  }
  const prompt = "> "
  const promptWidth = Math.min(75, width)
  const promptLeft = Math.max(0, Math.floor((width - promptWidth) / 2))
  const promptY = Math.min(height - 2, logoStart + logoLines.length + 2)
  lines[promptY] = fitRaw(`${" ".repeat(promptLeft)}${fitRaw(prompt, promptWidth)}`, width)
  const footer = [
    snapshot.footer.directory,
    snapshot.footer.workspaceID ? `workspace ${snapshot.footer.workspaceID}` : undefined,
    snapshot.footer.mcp > 0 || snapshot.footer.mcpFailed
      ? `${snapshot.footer.mcp} MCP${snapshot.footer.mcpFailed ? "!" : ""}`
      : undefined,
    snapshot.footer.version ?? runtimeVersion(),
    "/help",
  ]
    .filter(Boolean)
    .join(" | ")
  lines[height - 1] = fitRaw(footer, width)
  return lines
}

export function createSurfaceFrame(input: {
  snapshot: TuiSurfaceSnapshot
  width: number
  height: number
}): TuiSurfaceFrame {
  const width = clampDimension(input.width, 80, 20, 240)
  const height = clampDimension(input.height, 24, 8, 100)
  const snapshot = input.snapshot
  if (!snapshot.sessionID && snapshot.transcript.length === 0) {
    const lines = homeLines(snapshot, width, height)
    return {
      version: TUI_SURFACE_VERSION,
      renderer: "shared/terminal-frame",
      width,
      height,
      sessionID: snapshot.sessionID,
      title: snapshot.title,
      status: snapshot.status,
      lines,
      rows: lines.map((line, y) => ({
        y,
        spans: [{ x: 0, text: line }],
      })),
    }
  }
  const header = `SlopCode | ${snapshot.header.title} | ${snapshot.status}`
  const footer = [
    snapshot.footer.directory,
    snapshot.footer.version ?? runtimeVersion(),
    snapshot.footer.workspaceID ? `workspace ${snapshot.footer.workspaceID}` : undefined,
    `lsp ${snapshot.footer.lsp}`,
    `mcp ${snapshot.footer.mcp}${snapshot.footer.mcpFailed ? "!" : ""}`,
    snapshot.footer.permissions ? `perm ${snapshot.footer.permissions}` : undefined,
    "/help",
  ]
    .filter(Boolean)
    .join(" | ")
  const prompt = "> "
  const bodyHeight = Math.max(1, height - 4)
  const useSidebar = width >= 90
  const body: string[] = []

  if (useSidebar) {
    const sidebarWidth = Math.min(32, Math.max(24, Math.floor(width * 0.3)))
    const mainWidth = width - sidebarWidth - 3
    const main = transcriptLines(snapshot, mainWidth)
    const side = sidebarLines(snapshot, sidebarWidth)
    for (let index = 0; index < bodyHeight; index++) {
      body.push(`${fit(main[index] ?? "", mainWidth)} | ${fit(side[index] ?? "", sidebarWidth)}`)
    }
  } else {
    const main = [...transcriptLines(snapshot, width), "", ...sidebarLines(snapshot, width)]
    for (let index = 0; index < bodyHeight; index++) body.push(fit(main[index] ?? "", width))
  }

  const lines = [
    fit(header, width),
    fit(tabLine(snapshot), width),
    ...body,
    fit(prompt, width),
    fit(footer, width),
  ].slice(0, height)
  while (lines.length < height) lines.push(" ".repeat(width))

  return {
    version: TUI_SURFACE_VERSION,
    renderer: "shared/terminal-frame",
    width,
    height,
    sessionID: snapshot.sessionID,
    title: snapshot.title,
    status: snapshot.status,
    lines,
    rows: lines.map((line, y) => ({
      y,
      spans: [{ x: 0, text: line }],
    })),
  }
}
