import { Schema } from "effect"
import { PtyID } from "@slopcode-ai/core/pty/schema"
import { PtyTicket } from "@slopcode-ai/core/pty/ticket"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQueryFields } from "../middleware/workspace-routing"
import { ApiNotFoundError, ForbiddenError, InvalidRequestError, ServiceUnavailableError } from "../errors"
import { described } from "./metadata"

export const MAX_REMOTE_PATH_LENGTH = 4096
export const MAX_REMOTE_ENTRY_NAME_LENGTH = 256
export const MAX_REMOTE_ENTRIES = 200
export const MAX_CODEX_PROMPT_LENGTH = 32 * 1024
export const MAX_CODEX_CONFIG_VALUE_LENGTH = 128
export const MAX_CODEX_OUTPUT_BYTES = 64 * 1024
export const CODEX_TIMEOUT = "30 seconds"
export const MAX_REMOTE_AGENT_VERSION_LENGTH = 128
export const MAX_REMOTE_AGENT_COMMANDS = 256
export const MAX_REMOTE_AGENT_COMMAND_NAME_LENGTH = 128
export const MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH = 512
export const MAX_REMOTE_AGENT_COMMAND_VALUE_LENGTH = 128
export const MAX_REMOTE_AGENT_CATALOG_BYTES = 128 * 1024
export const REMOTE_AGENT_VERSION_TIMEOUT = "10 seconds"

const BoundedPath = Schema.String.check(Schema.isMinLength(1)).check(Schema.isMaxLength(MAX_REMOTE_PATH_LENGTH))
const BoundedAuthority = Schema.String.check(Schema.isMinLength(3)).check(Schema.isMaxLength(320))
const SafeConfigValue = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_CODEX_CONFIG_VALUE_LENGTH))
  .check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/))
const BoundedVersion = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_REMOTE_AGENT_VERSION_LENGTH))
  .check(Schema.isPattern(/^[^\u0000-\u001f\u007f]+$/))
const BoundedCommandName = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_REMOTE_AGENT_COMMAND_NAME_LENGTH))
  .check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/))
const BoundedCommandDescription = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH))
  .check(Schema.isPattern(/^[^\u0000-\u001f\u007f]+$/))
const BoundedCommandValue = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_REMOTE_AGENT_COMMAND_VALUE_LENGTH))
  .check(Schema.isPattern(/^[^\u0000-\u001f\u007f]+$/))

export const RemoteBrowseQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.optional(BoundedPath),
  sshAuthority: Schema.optional(BoundedAuthority),
  sshPort: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65_535 }))),
})

export const RemoteAgentConfig = Schema.Struct({
  model: Schema.optional(SafeConfigValue),
  profile: Schema.optional(SafeConfigValue),
  sandbox: Schema.optional(Schema.Literals(["read-only", "workspace-write", "danger-full-access"])),
  approval: Schema.optional(Schema.Literals(["untrusted", "on-failure", "on-request", "never"])),
  permissionMode: Schema.optional(
    Schema.Literals(["acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"]),
  ),
})

export const RemoteAgent = Schema.Literals(["codex-cli", "opencode-cli", "claude-code"])

export const RemoteAgentPrompt = Schema.Struct({
  agent: RemoteAgent,
  prompt: Schema.String.check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(MAX_CODEX_PROMPT_LENGTH))
    .check(Schema.isPattern(/^[^\0]*$/)),
  config: Schema.optional(RemoteAgentConfig),
})

export const RemoteAgentSessionCreate = Schema.Struct({
  agent: RemoteAgent,
  config: Schema.optional(RemoteAgentConfig),
})

export const RemoteAgentPromptQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.optional(BoundedPath),
})

export const RemoteAgentCatalogQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  agent: RemoteAgent,
  path: Schema.optional(BoundedPath),
})

export const RemoteFolderEntry = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(MAX_REMOTE_ENTRY_NAME_LENGTH)),
  path: BoundedPath,
  type: Schema.Literals(["directory", "file", "symlink", "other"]),
})

export const RemoteBrowseResult = Schema.Struct({
  root: BoundedPath,
  current: BoundedPath,
  parent: Schema.optional(BoundedPath),
  entries: Schema.Array(RemoteFolderEntry).check(Schema.isMaxLength(MAX_REMOTE_ENTRIES)),
})

export const RemoteAgentResult = Schema.Struct({
  output: Schema.String.check(Schema.isMaxLength(MAX_CODEX_OUTPUT_BYTES)),
  status: Schema.Literals(["completed", "failed", "timed_out"]),
  exitCode: Schema.optional(Schema.Number.check(Schema.isInt())),
})

export const RemoteAgentSession = Schema.Struct({
  ptyID: PtyID,
  directory: BoundedPath,
  ...PtyTicket.ConnectToken.fields,
})

export const RemoteAgentCommand = Schema.Struct({
  name: BoundedCommandName,
  description: Schema.optional(BoundedCommandDescription),
  agent: Schema.optional(BoundedCommandValue),
  model: Schema.optional(BoundedCommandValue),
  subtask: Schema.optional(Schema.Boolean),
})

export const RemoteAgentCatalog = Schema.Struct({
  agent: RemoteAgent,
  version: BoundedVersion,
  commands: Schema.Array(RemoteAgentCommand).check(Schema.isMaxLength(MAX_REMOTE_AGENT_COMMANDS)),
})

export const RemoteRuntimePaths = {
  browse: "/remote/ssh/browse",
  prompt: "/remote/agent/prompt",
  catalog: "/remote/agent/catalog",
  session: "/remote/agent/session",
} as const

export const RemoteRuntimeApi = HttpApi.make("remote-runtime")
  .add(
    HttpApiGroup.make("remote-runtime")
      .add(
        HttpApiEndpoint.get("browse", RemoteRuntimePaths.browse, {
          query: RemoteBrowseQuery,
          success: described(RemoteBrowseResult, "Remote folder listing"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.ssh.browse",
            summary: "Browse remote folders",
            description:
              "List bounded metadata for folders within the current authenticated instance directory or a strict key-backed SSH authority; an omitted path starts at that root.",
          }),
        ),
        HttpApiEndpoint.post("prompt", RemoteRuntimePaths.prompt, {
          query: RemoteAgentPromptQuery,
          payload: RemoteAgentPrompt,
          success: described(RemoteAgentResult, "Selected agent CLI result"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.prompt",
            summary: "Run a selected agent CLI prompt",
            description:
              "Run the fixed Codex, OpenCode, or Claude Code CLI executable selected by the caller in a bounded folder within the current authenticated instance directory with bounded output and allowlisted configuration.",
          }),
        ),
        HttpApiEndpoint.post("session", RemoteRuntimePaths.session, {
          query: RemoteAgentPromptQuery,
          payload: RemoteAgentSessionCreate,
          success: described(RemoteAgentSession, "Interactive remote agent session"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.session",
            summary: "Open an interactive remote agent session",
            description:
              "Start the selected fixed agent CLI in a bounded remote folder and return a single-use PTY WebSocket ticket.",
          }),
        ),
        HttpApiEndpoint.get("catalog", RemoteRuntimePaths.catalog, {
          query: RemoteAgentCatalogQuery,
          success: described(RemoteAgentCatalog, "Remote agent version and command catalog"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.catalog",
            summary: "List remote agent commands",
            description:
              "Run a fixed agent --version command and return bounded built-in and project-local command metadata without returning command templates.",
          }),
        ),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "remote runtime",
      description: "Authenticated runtime endpoints for remote folder browsing, agent prompts, and command catalogs.",
    }),
  )

export type RemoteAgentConfig = typeof RemoteAgentConfig.Type
export type RemoteAgent = typeof RemoteAgent.Type
export type RemoteAgentPrompt = typeof RemoteAgentPrompt.Type
export type RemoteAgentSessionCreate = typeof RemoteAgentSessionCreate.Type
export type RemoteAgentPromptQuery = typeof RemoteAgentPromptQuery.Type
export type RemoteAgentCatalogQuery = typeof RemoteAgentCatalogQuery.Type
export type RemoteBrowseQuery = typeof RemoteBrowseQuery.Type
export type RemoteBrowseResult = typeof RemoteBrowseResult.Type
export type RemoteAgentResult = typeof RemoteAgentResult.Type
export type RemoteAgentSession = typeof RemoteAgentSession.Type
export type RemoteAgentCommand = typeof RemoteAgentCommand.Type
export type RemoteAgentCatalog = typeof RemoteAgentCatalog.Type
