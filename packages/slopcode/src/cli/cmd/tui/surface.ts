import z from "zod"
import { Config } from "@/config/config"
import { Keybind } from "@/util/keybind"
import type { SessionStatus } from "@/session/status"
import type { Session } from "@/session"
import type { MessageV2 } from "@/session/message-v2"

export const TUI_SURFACE_VERSION = 1

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

type ManifestInput = {
  keybinds?: Record<string, string | undefined>
  android?: boolean
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
      const aliases = item.slash?.aliases?.length ? ` (${item.slash.aliases.map((alias) => `/${alias}`).join(", ")})` : ""
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
      const text = parts
        .map(partText)
        .filter(Boolean)
        .join("\n")
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
        input.files?.map((item) =>
          `${item.status.padStart(8)} ${item.path}${item.added || item.removed ? ` +${item.added ?? 0}/-${item.removed ?? 0}` : ""}`,
        ) ?? [],
    },
  }
}
