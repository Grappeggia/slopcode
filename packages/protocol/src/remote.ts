import { AbsolutePath, PositiveInt, Workspace } from "@slopcode-ai/schema"
import { Schema } from "effect"

const Text = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
const Port = PositiveInt.check(Schema.isLessThanOrEqualTo(65535))

export const RemoteVersion = Schema.Literal("v1").annotate({ identifier: "RemoteV1.Version" })
export type RemoteVersion = typeof RemoteVersion.Type

export const RemoteMode = Schema.Union([Schema.Literal("local"), Schema.Literal("ssh")]).annotate({
  identifier: "RemoteV1.Mode",
})
export type RemoteMode = typeof RemoteMode.Type

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

export const RemoteWorkspaceLocal = Schema.Struct({
  id: Workspace.ID,
  name: Text,
  mode: Schema.Literal("local"),
  directory: AbsolutePath,
}).annotate({ identifier: "RemoteV1.WorkspaceLocal" })
export type RemoteWorkspaceLocal = typeof RemoteWorkspaceLocal.Type
export type RemoteWorkspaceLocalEncoded = typeof RemoteWorkspaceLocal.Encoded

export const RemoteWorkspaceSsh = Schema.Struct({
  id: Workspace.ID,
  name: Text,
  mode: Schema.Literal("ssh"),
  directory: AbsolutePath,
  remoteDirectory: AbsolutePath,
  ssh: RemoteSshProfile,
}).annotate({ identifier: "RemoteV1.WorkspaceSsh" })
export type RemoteWorkspaceSsh = typeof RemoteWorkspaceSsh.Type
export type RemoteWorkspaceSshEncoded = typeof RemoteWorkspaceSsh.Encoded

export const RemoteWorkspace = Schema.Union([RemoteWorkspaceLocal, RemoteWorkspaceSsh]).annotate({
  identifier: "RemoteV1.Workspace",
})
export type RemoteWorkspace = typeof RemoteWorkspace.Type
export type RemoteWorkspaceEncoded = typeof RemoteWorkspace.Encoded

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
  device: RemoteDevice,
  host: RemoteHost,
  workspace: RemoteWorkspace,
  capability: RemoteCapability,
}).annotate({ identifier: "RemoteV1.Pairing" })
export type RemotePairing = typeof RemotePairing.Type
export type RemotePairingEncoded = typeof RemotePairing.Encoded

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
