import { Schema } from "effect"
import { PtyID } from "@slopcode-ai/core/pty/schema"
import { PtyTicket } from "@slopcode-ai/core/pty/ticket"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
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
export const MAX_REMOTE_JOB_ID_LENGTH = 256
export const MAX_REMOTE_JOB_OUTPUT_BYTES = 64 * 1024
export const MAX_REMOTE_JOB_EVENTS = 2048
export const MAX_REMOTE_REVIEW_FILES = 64
export const MAX_REMOTE_REVIEW_DIFF_BYTES = 64 * 1024
export const MAX_REMOTE_REVIEW_TESTS = 64
export const MAX_REMOTE_REVIEW_SCREENSHOTS = 16
export const MAX_REMOTE_REVIEW_COMMENTS = 128

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
const BoundedID = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_REMOTE_JOB_ID_LENGTH))
  .check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/))
const ReviewText = Schema.String.check(Schema.isMaxLength(MAX_REMOTE_REVIEW_DIFF_BYTES))
const ReviewPath = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(MAX_REMOTE_PATH_LENGTH))
  .check(Schema.isPattern(/^[^\u0000\r\n?#]+$/))
const ReviewName = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(256))
  .check(Schema.isPattern(/^[^\u0000\r\n]+$/))
const ReviewMessage = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(4096))
  .check(Schema.isPattern(/^[^\u0000]+$/))

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
  commandPreview: Schema.optional(
    Schema.Struct({
      executable: ReviewName,
      args: Schema.Array(ReviewMessage).check(Schema.isMaxLength(64)),
      cwd: ReviewPath,
    }),
  ),
  review: Schema.optional(
    Schema.Struct({
      files: Schema.Array(
        Schema.Struct({
          path: ReviewPath,
          status: Schema.Literals(["added", "modified", "deleted", "renamed", "untracked"]),
          additions: Schema.Number.check(Schema.isInt()),
          deletions: Schema.Number.check(Schema.isInt()),
          diff: ReviewText,
        }),
      ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_FILES)),
      tests: Schema.Array(
        Schema.Struct({
          name: ReviewName,
          status: Schema.Literals(["passed", "failed", "skipped"]),
          durationMs: Schema.optional(Schema.Number.check(Schema.isInt())),
          output: Schema.optional(ReviewText),
        }),
      ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_TESTS)),
      screenshots: Schema.Array(
        Schema.Struct({
          name: ReviewName,
          mime: Schema.String.check(Schema.isPattern(/^image\/[A-Za-z0-9.+-]+$/)),
          data: Schema.String.check(Schema.isMaxLength(512 * 1024)),
        }),
      ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_SCREENSHOTS)),
      comments: Schema.Array(
        Schema.Struct({
          id: BoundedID,
          path: ReviewPath,
          line: Schema.optional(Schema.Number.check(Schema.isInt())),
          body: ReviewMessage,
          createdAt: Schema.Number.check(Schema.isInt()),
        }),
      ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_COMMENTS)),
    }),
  ),
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

export const RemoteCommandPreview = Schema.Struct({
  executable: ReviewName,
  args: Schema.Array(ReviewMessage).check(Schema.isMaxLength(64)),
  cwd: ReviewPath,
})

export const RemoteApproval = Schema.Struct({
  id: Schema.optional(BoundedID),
  revision: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000_000 }))),
  title: ReviewMessage,
  command: Schema.optional(ReviewMessage),
  cwd: Schema.optional(ReviewPath),
  reason: Schema.optional(ReviewMessage),
  risk: Schema.optional(Schema.Literals(["low", "medium", "high"])),
})

export const RemoteQuestion = Schema.Struct({
  id: Schema.optional(BoundedID),
  revision: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000_000 }))),
  prompt: ReviewMessage,
  options: Schema.optional(Schema.Array(ReviewMessage).check(Schema.isMaxLength(32))),
  allowFreeform: Schema.optional(Schema.Boolean),
})

export const RemoteReview = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      path: ReviewPath,
      status: Schema.Literals(["added", "modified", "deleted", "renamed", "untracked"]),
      additions: Schema.Number.check(Schema.isInt()),
      deletions: Schema.Number.check(Schema.isInt()),
      diff: ReviewText,
    }),
  ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_FILES)),
  tests: Schema.Array(
    Schema.Struct({
      name: ReviewName,
      status: Schema.Literals(["passed", "failed", "skipped"]),
      durationMs: Schema.optional(Schema.Number.check(Schema.isInt())),
      output: Schema.optional(ReviewText),
    }),
  ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_TESTS)),
  screenshots: Schema.Array(
    Schema.Struct({
      name: ReviewName,
      mime: Schema.String.check(Schema.isPattern(/^image\/[A-Za-z0-9.+-]+$/)),
      data: Schema.String.check(Schema.isMaxLength(512 * 1024)),
    }),
  ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_SCREENSHOTS)),
  comments: Schema.Array(
    Schema.Struct({
      id: BoundedID,
      path: ReviewPath,
      line: Schema.optional(Schema.Number.check(Schema.isInt())),
      body: ReviewMessage,
      createdAt: Schema.Number.check(Schema.isInt()),
    }),
  ).check(Schema.isMaxLength(MAX_REMOTE_REVIEW_COMMENTS)),
})

export const RemoteAgentJobState = Schema.Struct({
  id: BoundedID,
  workspaceID: BoundedID,
  directory: ReviewPath,
  agent: RemoteAgent,
  status: Schema.Literals([
    "queued",
    "running",
    "waiting_approval",
    "waiting_question",
    "retrying",
    "completed",
    "failed",
    "stopped",
  ]),
  sessionID: Schema.optional(PtyID),
  cursor: Schema.optional(BoundedID),
  output: Schema.optional(Schema.String.check(Schema.isMaxLength(MAX_REMOTE_JOB_OUTPUT_BYTES))),
  error: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  progress: Schema.optional(Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 }))),
  commandPreview: Schema.optional(RemoteCommandPreview),
  approval: Schema.optional(RemoteApproval),
  question: Schema.optional(RemoteQuestion),
  review: Schema.optional(RemoteReview),
  updatedAt: Schema.Number.check(Schema.isInt()),
})

export const RemoteAgentJobStart = Schema.Struct({
  jobID: Schema.optional(BoundedID),
  idempotencyKey: Schema.optional(BoundedID),
  agent: RemoteAgent,
  prompt: RemoteAgentPrompt.fields.prompt,
  config: Schema.optional(RemoteAgentConfig),
})

export const RemoteAgentJobAction = Schema.Struct({
  action: Schema.Literals(["approve", "reject", "answer", "steer", "comment", "stop", "retry"]),
  interactionID: Schema.optional(BoundedID),
  expectedRevision: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000_000 }))),
  idempotencyKey: Schema.optional(BoundedID),
  answer: Schema.optional(ReviewMessage),
  prompt: Schema.optional(ReviewMessage),
  comment: Schema.optional(
    Schema.Struct({
      path: ReviewPath,
      line: Schema.optional(Schema.Number.check(Schema.isInt())),
      body: ReviewMessage,
    }),
  ),
})

export const RemoteAgentJobEventsQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  job: BoundedID,
  path: Schema.optional(BoundedPath),
  cursor: Schema.optional(BoundedID),
})

export const RemoteAgentJobActionQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.optional(BoundedPath),
})

export const RemoteAgentJobEvent = Schema.Struct({
  id: BoundedID,
  cursor: BoundedID,
  jobID: BoundedID,
  type: ReviewName,
  data: Schema.Struct({
    output: Schema.optional(Schema.String.check(Schema.isMaxLength(MAX_REMOTE_JOB_OUTPUT_BYTES))),
    error: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
    message: Schema.optional(ReviewMessage),
    progress: Schema.optional(Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 }))),
    sessionID: Schema.optional(PtyID),
    commandPreview: Schema.optional(RemoteCommandPreview),
    approval: Schema.optional(RemoteApproval),
    question: Schema.optional(RemoteQuestion),
    review: Schema.optional(RemoteReview),
    state: Schema.optional(RemoteAgentJobState),
  }),
})

export const RemoteAgentJobArtifact = Schema.Struct({
  id: BoundedID,
  metadata: Schema.Record(BoundedCommandName, Schema.String.check(Schema.isMaxLength(2048))),
})

export const RemoteAgentPlanPrepare = Schema.Struct({
  planID: BoundedID,
  digest: BoundedID,
})

export const RemoteAgentPlanPrepared = Schema.Struct({
  token: BoundedID,
  expiresAt: Schema.Int,
})

export const RemoteAgentPlanCommit = Schema.Struct({
  token: BoundedID,
  digest: BoundedID,
})

export const RemoteAgentPlanCommitResult = Schema.Struct({
  status: Schema.Literals(["consumed", "expired", "used", "conflict", "missing"]),
})

export const RemoteRuntimePaths = {
  browse: "/remote/ssh/browse",
  prompt: "/remote/agent/prompt",
  catalog: "/remote/agent/catalog",
  session: "/remote/agent/session",
  job: "/remote/agent/job",
  jobEvents: "/remote/agent/job/events",
  jobAction: "/remote/agent/job/:jobID/action",
  jobState: "/remote/agent/job/:jobID",
  jobArtifact: "/remote/agent/job/:jobID/artifact",
  jobPlanPrepare: "/remote/agent/job/:jobID/plan/prepare",
  jobPlanCommit: "/remote/agent/job/:jobID/plan/commit",
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
        HttpApiEndpoint.post("job", RemoteRuntimePaths.job, {
          query: RemoteAgentPromptQuery,
          payload: RemoteAgentJobStart,
          success: described(RemoteAgentJobState, "Accepted remote agent job"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.job",
            summary: "Start a resumable remote agent job",
            description:
              "Start a remote agent with structured approval, question, steering, and review events. The job remains addressable by id while the client reconnects.",
          }),
        ),
        HttpApiEndpoint.get("jobEvents", RemoteRuntimePaths.jobEvents, {
          query: RemoteAgentJobEventsQuery,
          success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.job.events",
            summary: "Stream remote agent job events",
            description: "Replay events after a cursor and continue streaming structured remote agent updates.",
          }),
        ),
        HttpApiEndpoint.post("jobAction", RemoteRuntimePaths.jobAction, {
          params: { jobID: BoundedID },
          query: RemoteAgentJobActionQuery,
          payload: RemoteAgentJobAction,
          success: described(RemoteAgentJobState, "Updated remote agent job"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "remote.agent.job.action",
            summary: "Approve, answer, steer, review, stop, or retry a job",
            description:
              "Apply an idempotent user action to a remote job, including approval decisions, question answers, steering prompts, and review comments.",
          }),
        ),
        HttpApiEndpoint.get("jobState", RemoteRuntimePaths.jobState, {
          params: { jobID: BoundedID },
          query: RemoteAgentJobActionQuery,
          success: described(RemoteAgentJobState, "Durable remote agent job state"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }),
        HttpApiEndpoint.post("jobArtifact", RemoteRuntimePaths.jobArtifact, {
          params: { jobID: BoundedID },
          query: RemoteAgentJobActionQuery,
          payload: RemoteAgentJobArtifact,
          success: described(Schema.Literals(["saved", "duplicate", "quota"]), "Persisted artifact metadata result"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }),
        HttpApiEndpoint.post("jobPlanPrepare", RemoteRuntimePaths.jobPlanPrepare, {
          params: { jobID: BoundedID },
          query: RemoteAgentJobActionQuery,
          payload: RemoteAgentPlanPrepare,
          success: described(RemoteAgentPlanPrepared, "Prepared durable plan save"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }),
        HttpApiEndpoint.post("jobPlanCommit", RemoteRuntimePaths.jobPlanCommit, {
          params: { jobID: BoundedID },
          query: RemoteAgentJobActionQuery,
          payload: RemoteAgentPlanCommit,
          success: described(RemoteAgentPlanCommitResult, "Committed durable plan save"),
          error: [InvalidRequestError, ForbiddenError, ApiNotFoundError, ServiceUnavailableError],
        }),
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
export type RemoteCommandPreview = typeof RemoteCommandPreview.Type
export type RemoteApproval = typeof RemoteApproval.Type
export type RemoteQuestion = typeof RemoteQuestion.Type
export type RemoteReview = typeof RemoteReview.Type
export type RemoteAgentJobState = typeof RemoteAgentJobState.Type
export type RemoteAgentJobStart = typeof RemoteAgentJobStart.Type
export type RemoteAgentJobAction = typeof RemoteAgentJobAction.Type
export type RemoteAgentJobEventsQuery = typeof RemoteAgentJobEventsQuery.Type
export type RemoteAgentJobActionQuery = typeof RemoteAgentJobActionQuery.Type
export type RemoteAgentJobEvent = typeof RemoteAgentJobEvent.Type
export type RemoteAgentJobArtifact = typeof RemoteAgentJobArtifact.Type
export type RemoteAgentPlanPrepare = typeof RemoteAgentPlanPrepare.Type
export type RemoteAgentPlanPrepared = typeof RemoteAgentPlanPrepared.Type
export type RemoteAgentPlanCommit = typeof RemoteAgentPlanCommit.Type
export type RemoteAgentPlanCommitResult = typeof RemoteAgentPlanCommitResult.Type
