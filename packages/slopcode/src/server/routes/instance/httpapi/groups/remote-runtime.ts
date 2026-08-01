import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
  WorkspaceRoutingQueryFields,
} from "../middleware/workspace-routing"
import { ApiNotFoundError, ForbiddenError, InvalidRequestError, ServiceUnavailableError } from "../errors"
import { described } from "./metadata"

export const MAX_REMOTE_PATH_LENGTH = 4096
export const MAX_REMOTE_ENTRY_NAME_LENGTH = 256
export const MAX_REMOTE_ENTRIES = 200
export const MAX_CODEX_PROMPT_LENGTH = 32 * 1024
export const MAX_CODEX_CONFIG_VALUE_LENGTH = 128
export const MAX_CODEX_OUTPUT_BYTES = 64 * 1024
export const CODEX_TIMEOUT = "30 seconds"

const BoundedPath = Schema.String.check(Schema.isMinLength(1)).check(Schema.isMaxLength(MAX_REMOTE_PATH_LENGTH))
const SafeConfigValue = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_CODEX_CONFIG_VALUE_LENGTH))
  .check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/))

export const RemoteBrowseQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: BoundedPath,
})

export const RemoteAgentConfig = Schema.Struct({
  model: Schema.optional(SafeConfigValue),
  profile: Schema.optional(SafeConfigValue),
  sandbox: Schema.optional(Schema.Literals(["read-only", "workspace-write", "danger-full-access"])),
  approval: Schema.optional(Schema.Literals(["untrusted", "on-failure", "on-request", "never"])),
})

export const RemoteAgentPrompt = Schema.Struct({
  prompt: Schema.String.check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(MAX_CODEX_PROMPT_LENGTH))
    .check(Schema.isPattern(/^[^\0]*$/)),
  config: Schema.optional(RemoteAgentConfig),
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

export const RemoteRuntimePaths = {
  browse: "/remote/ssh/browse",
  prompt: "/remote/agent/prompt",
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
            description: "List bounded metadata for folders within the current authenticated instance directory.",
          }),
        ),
        HttpApiEndpoint.post("prompt", RemoteRuntimePaths.prompt, {
          query: WorkspaceRoutingQuery,
          payload: RemoteAgentPrompt,
          success: described(RemoteAgentResult, "Codex CLI result"),
          error: [InvalidRequestError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.prompt",
            summary: "Run a Codex CLI prompt",
            description:
              "Run the fixed Codex CLI executable in the current instance directory with bounded output and allowlisted configuration.",
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
      description: "Authenticated runtime endpoints for remote folder browsing and Codex CLI prompts.",
    }),
  )

export type RemoteAgentConfig = typeof RemoteAgentConfig.Type
export type RemoteAgentPrompt = typeof RemoteAgentPrompt.Type
export type RemoteBrowseQuery = typeof RemoteBrowseQuery.Type
export type RemoteBrowseResult = typeof RemoteBrowseResult.Type
export type RemoteAgentResult = typeof RemoteAgentResult.Type
