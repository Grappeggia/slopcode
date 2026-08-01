import { AbsolutePath, PositiveInt, Workspace } from "@slopcode-ai/schema"
import { Schema, SchemaParser, Struct } from "effect"

const Text = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
const Port = PositiveInt.check(Schema.isLessThanOrEqualTo(65535))
const exact = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) =>
  Schema.declareConstructor<S["Type"], S["Encoded"]>()(
    [schema],
    ([codec]) =>
      (u, _ast, options) =>
        SchemaParser.decodeUnknownEffect(codec, { ...options, onExcessProperty: "error" })(u),
  )

const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
const isSafePath = (value: string) =>
  value === "/" ||
  (value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\u0000") &&
    !value.includes("//") &&
    !/[?#]/.test(value) &&
    value
      .slice(1)
      .split("/")
      .every((segment) => segment.length > 0 && segment !== "." && segment !== ".."))
const isLoopbackTarget = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    if (url.username || url.password || url.search || url.hash) return false
    if (!loopback.has(url.hostname.toLowerCase())) return false
    return isSafePath(url.pathname)
  } catch {
    return false
  }
}

export const RemoteVersion = Schema.Literal("v1").annotate({ identifier: "RemoteV1.Version" })
export type RemoteVersion = typeof RemoteVersion.Type

export const RemoteMode = Schema.Union([Schema.Literal("local"), Schema.Literal("ssh")]).annotate({
  identifier: "RemoteV1.Mode",
})
export type RemoteMode = typeof RemoteMode.Type

export const RemoteAgentMode = Schema.Union([
  Schema.Literal("local-slopcode"),
  Schema.Literal("codex-cli"),
  Schema.Literal("opencode-cli"),
  Schema.Literal("claude-code"),
]).annotate({ identifier: "RemoteV1.AgentMode" })
export type RemoteAgentMode = typeof RemoteAgentMode.Type

export const RemoteRequestID = Schema.String.check(Schema.isPattern(/^req_[a-zA-Z0-9._:-]+$/)).pipe(
  Schema.brand("RemoteV1.RequestID"),
)
export type RemoteRequestID = typeof RemoteRequestID.Type

export const RemoteEventCursor = Schema.String.check(Schema.isPattern(/^cur_[a-zA-Z0-9._:-]+$/)).pipe(
  Schema.brand("RemoteV1.EventCursor"),
)
export type RemoteEventCursor = typeof RemoteEventCursor.Type

export const RemoteIdempotencyKey = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/)).pipe(
  Schema.brand("RemoteV1.IdempotencyKey"),
)
export type RemoteIdempotencyKey = typeof RemoteIdempotencyKey.Type

export const RemotePairingID = Schema.String.check(Schema.isPattern(/^pair_[a-zA-Z0-9._:-]+$/)).pipe(
  Schema.brand("RemoteV1.PairingID"),
)
export type RemotePairingID = typeof RemotePairingID.Type

export const RemotePairingCode = Schema.String.check(Schema.isPattern(/^[A-Z0-9]{6}$/)).pipe(
  Schema.brand("RemoteV1.PairingCode"),
)
export type RemotePairingCode = typeof RemotePairingCode.Type

export const RemoteDeviceID = Schema.String.check(Schema.isPattern(/^dev_[a-zA-Z0-9._:-]+$/)).pipe(
  Schema.brand("RemoteV1.DeviceID"),
)
export type RemoteDeviceID = typeof RemoteDeviceID.Type

export const RemoteSelectionNonce = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{16,128}$/)).pipe(
  Schema.brand("RemoteV1.SelectionNonce"),
)
export type RemoteSelectionNonce = typeof RemoteSelectionNonce.Type

export const RemotePairingSelection = exact(
  Schema.Struct({
    nonce: RemoteSelectionNonce,
    deviceID: RemoteDeviceID,
    code: RemotePairingCode,
  }),
).annotate({ identifier: "RemoteV1.PairingSelection" })
export type RemotePairingSelection = typeof RemotePairingSelection.Type
export type RemotePairingSelectionEncoded = typeof RemotePairingSelection.Encoded

const RemotePairingSelectionWire = Schema.Struct({
  nonce: RemoteSelectionNonce,
  deviceID: RemoteDeviceID,
  code: RemotePairingCode,
}).annotate({ identifier: "RemoteV1.PairingSelectionWire" })

export const RemoteHostID = Schema.String.check(Schema.isPattern(/^hst_[a-zA-Z0-9._:-]+$/)).pipe(
  Schema.brand("RemoteV1.HostID"),
)
export type RemoteHostID = typeof RemoteHostID.Type

export const RemoteDevice = Schema.Struct({
  id: RemoteDeviceID,
  name: Text,
  platform: Text,
  arch: Text,
  version: Text,
}).annotate({ identifier: "RemoteV1.Device" })
export type RemoteDevice = typeof RemoteDevice.Type
export type RemoteDeviceEncoded = typeof RemoteDevice.Encoded

export const RemoteHost = Schema.Struct({
  id: RemoteHostID,
  name: Text,
  platform: Text,
  arch: Text,
  version: Text,
  mode: RemoteMode,
}).annotate({ identifier: "RemoteV1.Host" })
export type RemoteHost = typeof RemoteHost.Type
export type RemoteHostEncoded = typeof RemoteHost.Encoded

export const RemoteSshProfile = Schema.Struct({
  host: Text,
  port: Port,
  user: Text,
}).annotate({ identifier: "RemoteV1.SshProfile" })
export type RemoteSshProfile = typeof RemoteSshProfile.Type
export type RemoteSshProfileEncoded = typeof RemoteSshProfile.Encoded

export const RemoteSshFolderLimits = {
  maxEntries: 512,
  maxNameLength: 255,
  maxPathLength: 4096,
  maxRecentFolders: 3,
} as const

const isSafePosixPath = (value: string) =>
  value === "/" ||
  (value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\u0000") &&
    !/[\u0001-\u001f\u007f]/.test(value) &&
    value
      .slice(1)
      .split("/")
      .every((segment) => segment.length > 0 && segment !== "." && segment !== ".."))

export const RemoteSshAbsolutePath = AbsolutePath.check(
  Schema.isMaxLength(RemoteSshFolderLimits.maxPathLength),
  Schema.makeFilter((value: string) =>
    isSafePosixPath(value) ? undefined : "SSH folder paths must be canonical absolute POSIX paths",
  ),
).annotate({ identifier: "RemoteV1.SshAbsolutePath" })
export type RemoteSshAbsolutePath = typeof RemoteSshAbsolutePath.Type

export const RemoteSshFolderName = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(RemoteSshFolderLimits.maxNameLength),
  Schema.makeFilter((value: string) =>
    value !== "." && value !== ".." && !/[\u0000-\u001f\u007f\\/]/.test(value)
      ? undefined
      : "SSH folder names must not contain path separators or traversal segments",
  ),
).annotate({ identifier: "RemoteV1.SshFolderName" })
export type RemoteSshFolderName = typeof RemoteSshFolderName.Type

export const RemoteSshFolderEntryKind = Schema.Union([
  Schema.Literal("directory"),
  Schema.Literal("file"),
  Schema.Literal("symlink"),
]).annotate({ identifier: "RemoteV1.SshFolderEntryKind" })
export type RemoteSshFolderEntryKind = typeof RemoteSshFolderEntryKind.Type

export const RemoteSshFolderEntry = exact(
  Schema.Struct({
    name: RemoteSshFolderName,
    path: RemoteSshAbsolutePath,
    kind: RemoteSshFolderEntryKind,
  }),
).annotate({ identifier: "RemoteV1.SshFolderEntry" })
export type RemoteSshFolderEntry = typeof RemoteSshFolderEntry.Type
export type RemoteSshFolderEntryEncoded = typeof RemoteSshFolderEntry.Encoded

export const RemoteSshFolderListing = exact(
  Schema.Struct({
    path: RemoteSshAbsolutePath,
    entries: Schema.Array(RemoteSshFolderEntry).check(Schema.isMaxLength(RemoteSshFolderLimits.maxEntries)),
    recentFolders: Schema.Array(RemoteSshAbsolutePath).check(
      Schema.isMaxLength(RemoteSshFolderLimits.maxRecentFolders),
    ),
  }),
).annotate({ identifier: "RemoteV1.SshFolderListing" })
export type RemoteSshFolderListing = typeof RemoteSshFolderListing.Type
export type RemoteSshFolderListingEncoded = typeof RemoteSshFolderListing.Encoded

const RemoteCodexCliText = (limit: number, label: string) =>
  Schema.String.check(
    Schema.isMaxLength(limit),
    Schema.makeFilter((value: string) =>
      value.includes("\u0000") ? `${label} must not contain NUL bytes` : undefined,
    ),
  )

export const RemoteCodexCliPrompt = RemoteCodexCliText(64 * 1024, "Codex CLI prompt")
  .check(Schema.isNonEmpty())
  .annotate({ identifier: "RemoteV1.CodexCliPrompt" })
export type RemoteCodexCliPrompt = typeof RemoteCodexCliPrompt.Type

export const RemoteCodexCliModel = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/),
).annotate({ identifier: "RemoteV1.CodexCliModel" })
export type RemoteCodexCliModel = typeof RemoteCodexCliModel.Type

export const RemoteCodexCliProfile = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(64),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
).annotate({ identifier: "RemoteV1.CodexCliProfile" })
export type RemoteCodexCliProfile = typeof RemoteCodexCliProfile.Type

export const RemoteCodexCliSandbox = Schema.Union([
  Schema.Literal("read-only"),
  Schema.Literal("workspace-write"),
  Schema.Literal("danger-full-access"),
]).annotate({ identifier: "RemoteV1.CodexCliSandbox" })
export type RemoteCodexCliSandbox = typeof RemoteCodexCliSandbox.Type

export const RemoteCodexCliApproval = Schema.Union([
  Schema.Literal("untrusted"),
  Schema.Literal("on-failure"),
  Schema.Literal("on-request"),
  Schema.Literal("never"),
]).annotate({ identifier: "RemoteV1.CodexCliApproval" })
export type RemoteCodexCliApproval = typeof RemoteCodexCliApproval.Type

export const RemoteClaudeCodePermissionMode = Schema.Union([
  Schema.Literal("default"),
  Schema.Literal("acceptEdits"),
  Schema.Literal("plan"),
  Schema.Literal("bypassPermissions"),
]).annotate({ identifier: "RemoteV1.ClaudeCodePermissionMode" })
export type RemoteClaudeCodePermissionMode = typeof RemoteClaudeCodePermissionMode.Type

export const RemoteCodexCliConfig = exact(
  Schema.Struct({
    model: Schema.optional(RemoteCodexCliModel),
    profile: Schema.optional(RemoteCodexCliProfile),
    sandbox: Schema.optional(RemoteCodexCliSandbox),
    approval: Schema.optional(RemoteCodexCliApproval),
    permissionMode: Schema.optional(RemoteClaudeCodePermissionMode),
  }),
).annotate({ identifier: "RemoteV1.CodexCliConfig" })
export type RemoteCodexCliConfig = typeof RemoteCodexCliConfig.Type
export type RemoteCodexCliConfigEncoded = typeof RemoteCodexCliConfig.Encoded

export const RemoteCodexCliRequest = exact(
  Schema.Struct({
    // Omitted by legacy peers; absence means local-slopcode for compatibility.
    agent: Schema.optional(RemoteAgentMode),
    prompt: RemoteCodexCliPrompt,
    config: Schema.optional(RemoteCodexCliConfig),
  }),
).annotate({ identifier: "RemoteV1.CodexCliRequest" })
export type RemoteCodexCliRequest = typeof RemoteCodexCliRequest.Type
export type RemoteCodexCliRequestEncoded = typeof RemoteCodexCliRequest.Encoded

export const RemoteCodexCliResultStatus = Schema.Union([
  Schema.Literal("completed"),
  Schema.Literal("failed"),
  Schema.Literal("cancelled"),
]).annotate({ identifier: "RemoteV1.CodexCliResultStatus" })
export type RemoteCodexCliResultStatus = typeof RemoteCodexCliResultStatus.Type

export const RemoteCodexCliResultMetadata = exact(
  Schema.Struct({
    status: RemoteCodexCliResultStatus,
    exitCode: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(255))),
    durationMs: Schema.optional(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(86_400_000)),
    ),
    model: Schema.optional(RemoteCodexCliModel),
    profile: Schema.optional(RemoteCodexCliProfile),
    sandbox: Schema.optional(RemoteCodexCliSandbox),
    approval: Schema.optional(RemoteCodexCliApproval),
  }),
).annotate({ identifier: "RemoteV1.CodexCliResultMetadata" })
export type RemoteCodexCliResultMetadata = typeof RemoteCodexCliResultMetadata.Type
export type RemoteCodexCliResultMetadataEncoded = typeof RemoteCodexCliResultMetadata.Encoded

export const RemoteCodexCliResult = exact(
  Schema.Struct({
    // Omitted by legacy peers; absence means local-slopcode for compatibility.
    agent: Schema.optional(RemoteAgentMode),
    output: RemoteCodexCliText(1024 * 1024, "Codex CLI output"),
    metadata: RemoteCodexCliResultMetadata,
  }),
).annotate({ identifier: "RemoteV1.CodexCliResult" })
export type RemoteCodexCliResult = typeof RemoteCodexCliResult.Type
export type RemoteCodexCliResultEncoded = typeof RemoteCodexCliResult.Encoded

export const RemoteAgentPrompt = RemoteCodexCliPrompt.annotate({ identifier: "RemoteV1.AgentPrompt" })
export type RemoteAgentPrompt = typeof RemoteAgentPrompt.Type

export const RemoteAgentConfig = RemoteCodexCliConfig.annotate({ identifier: "RemoteV1.AgentConfig" })
export type RemoteAgentConfig = typeof RemoteAgentConfig.Type
export type RemoteAgentConfigEncoded = typeof RemoteAgentConfig.Encoded

export const RemoteAgentRequest = RemoteCodexCliRequest.annotate({ identifier: "RemoteV1.AgentRequest" })
export type RemoteAgentRequest = typeof RemoteAgentRequest.Type
export type RemoteAgentRequestEncoded = typeof RemoteAgentRequest.Encoded

export const RemoteAgentResultStatus = RemoteCodexCliResultStatus.annotate({ identifier: "RemoteV1.AgentResultStatus" })
export type RemoteAgentResultStatus = typeof RemoteAgentResultStatus.Type

export const RemoteAgentResultMetadata = RemoteCodexCliResultMetadata.annotate({
  identifier: "RemoteV1.AgentResultMetadata",
})
export type RemoteAgentResultMetadata = typeof RemoteAgentResultMetadata.Type
export type RemoteAgentResultMetadataEncoded = typeof RemoteAgentResultMetadata.Encoded

export const RemoteAgentResult = RemoteCodexCliResult.annotate({ identifier: "RemoteV1.AgentResult" })
export type RemoteAgentResult = typeof RemoteAgentResult.Type
export type RemoteAgentResultEncoded = typeof RemoteAgentResult.Encoded

const RemoteWorkspaceLocalShape = Schema.Struct({
  id: Workspace.ID,
  name: Text,
  mode: Schema.Literal("local"),
  directory: AbsolutePath,
})
export const RemoteWorkspaceLocal = exact(RemoteWorkspaceLocalShape).annotate({ identifier: "RemoteV1.WorkspaceLocal" })
export type RemoteWorkspaceLocal = typeof RemoteWorkspaceLocal.Type
export type RemoteWorkspaceLocalEncoded = typeof RemoteWorkspaceLocal.Encoded

const RemoteWorkspaceSshShape = Schema.Struct({
  id: Workspace.ID,
  name: Text,
  mode: Schema.Literal("ssh"),
  // Omitted by legacy peers; absence means local-slopcode for compatibility.
  agent: Schema.optional(RemoteAgentMode),
  directory: AbsolutePath,
  remoteDirectory: AbsolutePath,
  ssh: RemoteSshProfile,
})
export const RemoteWorkspaceSsh = exact(RemoteWorkspaceSshShape).annotate({ identifier: "RemoteV1.WorkspaceSsh" })
export type RemoteWorkspaceSsh = typeof RemoteWorkspaceSsh.Type
export type RemoteWorkspaceSshEncoded = typeof RemoteWorkspaceSsh.Encoded

export const RemoteWorkspace = exact(Schema.Union([RemoteWorkspaceLocalShape, RemoteWorkspaceSshShape])).annotate({
  identifier: "RemoteV1.Workspace",
})
export type RemoteWorkspace = typeof RemoteWorkspace.Type
export type RemoteWorkspaceEncoded = typeof RemoteWorkspace.Encoded

export const RemoteWorkspaceInput = Schema.Union([RemoteWorkspaceLocalShape, RemoteWorkspaceSshShape]).annotate({
  identifier: "RemoteV1.WorkspaceInput",
})
export type RemoteWorkspaceInput = typeof RemoteWorkspaceInput.Type
export type RemoteWorkspaceInputEncoded = typeof RemoteWorkspaceInput.Encoded

export const RemoteWorkspaceSshInput = RemoteWorkspaceSshShape.annotate({
  identifier: "RemoteV1.WorkspaceSshInput",
})
export type RemoteWorkspaceSshInput = typeof RemoteWorkspaceSshInput.Type
export type RemoteWorkspaceSshInputEncoded = typeof RemoteWorkspaceSshInput.Encoded

export const RemoteCapability = Schema.Struct({
  fs: Schema.Boolean,
  command: Schema.Boolean,
  pty: Schema.Boolean,
  events: Schema.Boolean,
  localWorkspace: Schema.Boolean,
  sshWorkspace: Schema.Boolean,
}).annotate({ identifier: "RemoteV1.Capability" })
export type RemoteCapability = typeof RemoteCapability.Type
export type RemoteCapabilityEncoded = typeof RemoteCapability.Encoded

export const RemotePairing = Schema.Struct({
  version: RemoteVersion,
  id: RemotePairingID,
  code: RemotePairingCode,
  selection: RemotePairingSelection,
  device: RemoteDevice,
  host: RemoteHost,
  workspace: RemoteWorkspace,
  capability: RemoteCapability,
}).annotate({ identifier: "RemoteV1.Pairing" })
export type RemotePairing = typeof RemotePairing.Type
export type RemotePairingEncoded = typeof RemotePairing.Encoded

export const RemotePairingRecord = Schema.Struct(Struct.omit(RemotePairing.fields, ["code", "selection"])).annotate({
  identifier: "RemoteV1.PairingRecord",
})
export type RemotePairingRecord = typeof RemotePairingRecord.Type
export type RemotePairingRecordEncoded = typeof RemotePairingRecord.Encoded

export const RemotePairingWire = Schema.Struct({
  version: RemoteVersion,
  id: RemotePairingID,
  code: RemotePairingCode,
  selection: RemotePairingSelectionWire,
  device: RemoteDevice,
  host: RemoteHost,
  workspace: RemoteWorkspaceInput,
  capability: RemoteCapability,
}).annotate({ identifier: "RemoteV1.PairingWire" })
export type RemotePairingWire = typeof RemotePairingWire.Type
export type RemotePairingWireEncoded = typeof RemotePairingWire.Encoded

export const RemotePairingRecordWire = Schema.Struct(
  Struct.omit(RemotePairingWire.fields, ["code", "selection"]),
).annotate({
  identifier: "RemoteV1.PairingRecordWire",
})
export type RemotePairingRecordWire = typeof RemotePairingRecordWire.Type
export type RemotePairingRecordWireEncoded = typeof RemotePairingRecordWire.Encoded

export const RemoteTargetCapabilityHeader = "x-slopcode-remote-capability" as const
const RemoteTargetCapability = Text.check(
  Schema.makeFilter((value: string) =>
    value.length <= 1024 && !/[\r\n]/.test(value)
      ? undefined
      : "Remote target capability must be a single bounded header value",
  ),
)
export const RemoteTargetHeaders = exact(
  Schema.Struct({
    [RemoteTargetCapabilityHeader]: RemoteTargetCapability,
  }),
).annotate({ identifier: "RemoteV1.TargetHeaders" })
export type RemoteTargetHeaders = typeof RemoteTargetHeaders.Type
export type RemoteTargetHeadersEncoded = typeof RemoteTargetHeaders.Encoded

export const RemoteTargetHeadersInput = Schema.Struct({
  [RemoteTargetCapabilityHeader]: RemoteTargetCapability,
}).annotate({ identifier: "RemoteV1.TargetHeadersInput" })
export type RemoteTargetHeadersInput = typeof RemoteTargetHeadersInput.Type
export type RemoteTargetHeadersInputEncoded = typeof RemoteTargetHeadersInput.Encoded

export const RemotePairedHost = Schema.Struct({
  host: RemoteHost,
  pairings: Schema.Array(RemotePairingRecord),
}).annotate({ identifier: "RemoteV1.PairedHost" })
export type RemotePairedHost = typeof RemotePairedHost.Type
export type RemotePairedHostEncoded = typeof RemotePairedHost.Encoded

export const RemotePairedHostWire = Schema.Struct({
  host: RemoteHost,
  pairings: Schema.Array(RemotePairingRecordWire),
}).annotate({ identifier: "RemoteV1.PairedHostWire" })
export type RemotePairedHostWire = typeof RemotePairedHostWire.Type
export type RemotePairedHostWireEncoded = typeof RemotePairedHostWire.Encoded

export const RemotePairingCreateInput = Schema.Struct({
  device: RemoteDevice,
  workspace: RemoteWorkspace,
  capability: Schema.optional(RemoteCapability),
}).annotate({ identifier: "RemoteV1.PairingCreateInput" })
export type RemotePairingCreateInput = typeof RemotePairingCreateInput.Type
export type RemotePairingCreateInputEncoded = typeof RemotePairingCreateInput.Encoded

export const RemotePairingCreatePayload = Schema.Struct({
  device: RemoteDevice,
  workspace: RemoteWorkspaceInput,
  capability: Schema.optional(RemoteCapability),
}).annotate({ identifier: "RemoteV1.PairingCreatePayload" })
export type RemotePairingCreatePayload = typeof RemotePairingCreatePayload.Type
export type RemotePairingCreatePayloadEncoded = typeof RemotePairingCreatePayload.Encoded

export const RemoteWorkspaceSelectInput = Schema.Struct({
  pairingID: RemotePairingID,
  deviceID: RemoteDeviceID,
  selectionNonce: RemoteSelectionNonce,
  selectionCode: RemotePairingCode,
}).annotate({ identifier: "RemoteV1.WorkspaceSelectInput" })
export type RemoteWorkspaceSelectInput = typeof RemoteWorkspaceSelectInput.Type
export type RemoteWorkspaceSelectInputEncoded = typeof RemoteWorkspaceSelectInput.Encoded

const RemoteTargetLocalShape = Schema.Struct({
  type: Schema.Literal("local"),
  directory: AbsolutePath,
})
export const RemoteTargetLocal = exact(RemoteTargetLocalShape).annotate({ identifier: "RemoteV1.TargetLocal" })
export type RemoteTargetLocal = typeof RemoteTargetLocal.Type
export type RemoteTargetLocalEncoded = typeof RemoteTargetLocal.Encoded

const RemoteTargetRemoteShape = Schema.Struct({
  type: Schema.Literal("remote"),
  url: Schema.String.check(
    Schema.makeFilter((value: string) =>
      isLoopbackTarget(value)
        ? undefined
        : "Remote target must be a loopback HTTP(S) base URL without credentials, query, fragment, or traversal",
    ),
  ),
  headers: Schema.optional(RemoteTargetHeaders),
})
export const RemoteTargetRemote = exact(RemoteTargetRemoteShape).annotate({ identifier: "RemoteV1.TargetRemote" })
export type RemoteTargetRemote = typeof RemoteTargetRemote.Type
export type RemoteTargetRemoteEncoded = typeof RemoteTargetRemote.Encoded

export const RemoteTarget = exact(Schema.Union([RemoteTargetLocalShape, RemoteTargetRemoteShape])).annotate({
  identifier: "RemoteV1.Target",
})
export type RemoteTarget = typeof RemoteTarget.Type
export type RemoteTargetEncoded = typeof RemoteTarget.Encoded

const RemoteTargetRemoteInputShape = Schema.Struct({
  type: Schema.Literal("remote"),
  url: RemoteTargetRemoteShape.fields.url,
  headers: Schema.optional(RemoteTargetHeadersInput),
})

export const RemoteTargetInput = Schema.Union([RemoteTargetLocalShape, RemoteTargetRemoteInputShape]).annotate({
  identifier: "RemoteV1.TargetInput",
})
export type RemoteTargetInput = typeof RemoteTargetInput.Type
export type RemoteTargetInputEncoded = typeof RemoteTargetInput.Encoded

export const RemoteWorkspaceTargetInput = Schema.Struct({
  pairingID: RemotePairingID,
  workspace: RemoteWorkspace,
  target: RemoteTarget,
}).annotate({ identifier: "RemoteV1.WorkspaceTargetInput" })
export type RemoteWorkspaceTargetInput = typeof RemoteWorkspaceTargetInput.Type
export type RemoteWorkspaceTargetInputEncoded = typeof RemoteWorkspaceTargetInput.Encoded

export const RemoteWorkspaceTargetPayload = Schema.Struct({
  pairingID: RemotePairingID,
  workspace: RemoteWorkspaceInput,
  target: RemoteTargetInput,
}).annotate({ identifier: "RemoteV1.WorkspaceTargetPayload" })
export type RemoteWorkspaceTargetPayload = typeof RemoteWorkspaceTargetPayload.Type
export type RemoteWorkspaceTargetPayloadEncoded = typeof RemoteWorkspaceTargetPayload.Encoded

export const RemoteAcknowledgement = Schema.Struct({
  requestID: RemoteRequestID,
  idempotencyKey: RemoteIdempotencyKey,
  cursor: Schema.optional(RemoteEventCursor),
}).annotate({ identifier: "RemoteV1.Acknowledgement" })
export type RemoteAcknowledgement = typeof RemoteAcknowledgement.Type
export type RemoteAcknowledgementEncoded = typeof RemoteAcknowledgement.Encoded

export const RemoteRequest = Schema.Struct({
  version: RemoteVersion,
  kind: Schema.Literal("request"),
  id: RemoteRequestID,
  type: Text,
  idempotencyKey: RemoteIdempotencyKey,
  device: RemoteDevice,
  host: RemoteHost,
  workspace: RemoteWorkspace,
  data: Schema.Unknown,
}).annotate({ identifier: "RemoteV1.Request" })
export type RemoteRequest = typeof RemoteRequest.Type
export type RemoteRequestEncoded = typeof RemoteRequest.Encoded

export const RemoteResponse = Schema.Struct({
  version: RemoteVersion,
  kind: Schema.Literal("response"),
  requestID: RemoteRequestID,
  ack: RemoteAcknowledgement,
  data: Schema.optional(Schema.Unknown),
}).annotate({ identifier: "RemoteV1.Response" })
export type RemoteResponse = typeof RemoteResponse.Type
export type RemoteResponseEncoded = typeof RemoteResponse.Encoded

export const RemoteEvent = Schema.Struct({
  version: RemoteVersion,
  kind: Schema.Literal("event"),
  cursor: RemoteEventCursor,
  type: Text,
  requestID: Schema.optional(RemoteRequestID),
  data: Schema.Unknown,
}).annotate({ identifier: "RemoteV1.Event" })
export type RemoteEvent = typeof RemoteEvent.Type
export type RemoteEventEncoded = typeof RemoteEvent.Encoded

export const RemoteError = Schema.Struct({
  version: RemoteVersion,
  kind: Schema.Literal("error"),
  requestID: Schema.optional(RemoteRequestID),
  idempotencyKey: Schema.optional(RemoteIdempotencyKey),
  code: Text,
  message: Text,
  retryable: Schema.Boolean,
  data: Schema.optional(Schema.Unknown),
}).annotate({ identifier: "RemoteV1.Error" })
export type RemoteError = typeof RemoteError.Type
export type RemoteErrorEncoded = typeof RemoteError.Encoded

export const RemoteEnvelope = Schema.Union([RemoteRequest, RemoteResponse, RemoteEvent, RemoteError]).annotate({
  identifier: "RemoteV1.Envelope",
})
export type RemoteEnvelope = typeof RemoteEnvelope.Type
export type RemoteEnvelopeEncoded = typeof RemoteEnvelope.Encoded

export const RemoteWorkspaceJson = Schema.fromJsonString(RemoteWorkspace).annotate({
  identifier: "RemoteV1.WorkspaceJson",
})
export type RemoteWorkspaceJson = typeof RemoteWorkspaceJson.Type
export type RemoteWorkspaceJsonEncoded = typeof RemoteWorkspaceJson.Encoded

export const RemoteEnvelopeJson = Schema.fromJsonString(RemoteEnvelope).annotate({
  identifier: "RemoteV1.EnvelopeJson",
})
export type RemoteEnvelopeJson = typeof RemoteEnvelopeJson.Type
export type RemoteEnvelopeJsonEncoded = typeof RemoteEnvelopeJson.Encoded
