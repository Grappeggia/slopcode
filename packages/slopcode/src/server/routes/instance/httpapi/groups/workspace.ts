import { Workspace } from "@/control-plane/workspace"
import { WorkspaceAdapterEntry } from "@/control-plane/types"
import {
  RemotePairedHostWire,
  RemotePairing,
  RemotePairingCreatePayload,
  RemotePairingRecordWire,
  RemotePairingWire,
  RemoteWorkspaceSelectInput,
  RemoteWorkspaceSsh,
  RemoteWorkspaceSshInput,
  RemoteWorkspaceTargetInput,
  RemoteWorkspaceTargetPayload,
} from "../../../../../../../protocol/src/remote"
import { Schema, Struct } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { ApiVcsApplyError } from "./instance"
import { ApiNotFoundError } from "../errors"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const root = "/experimental/workspace"
export const RemoteSupervisorTokenHeader = "x-slopcode-remote-supervisor-token"
export const CreatePayload = Schema.Struct(Struct.omit(Workspace.CreateInput.fields, ["projectID"]))
export const WarpPayload = Schema.Struct({
  id: Schema.NullOr(Workspace.Info.fields.id),
  sessionID: Workspace.SessionWarpInput.fields.sessionID,
  copyChanges: Workspace.SessionWarpInput.fields.copyChanges,
})

export class ApiWorkspaceWarpError extends Schema.ErrorClass<ApiWorkspaceWarpError>("WorkspaceWarpError")(
  {
    name: Schema.Literal("WorkspaceWarpError"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 400 },
) {}

export class ApiWorkspaceCreateError extends Schema.ErrorClass<ApiWorkspaceCreateError>("WorkspaceCreateError")(
  {
    name: Schema.Literal("WorkspaceCreateError"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 400 },
) {}

export class ApiWorkspaceRemoteSshValidationError extends Schema.ErrorClass<ApiWorkspaceRemoteSshValidationError>(
  "WorkspaceRemoteSshValidationError",
)(
  {
    name: Schema.Literal("WorkspaceRemoteSshValidationError"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 409 },
) {}

export class ApiWorkspaceRemoteSelectError extends Schema.ErrorClass<ApiWorkspaceRemoteSelectError>(
  "WorkspaceRemoteSelectError",
)(
  {
    name: Schema.Literal("WorkspaceRemoteSelectError"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 409 },
) {}

export class ApiWorkspaceRemoteTargetError extends Schema.ErrorClass<ApiWorkspaceRemoteTargetError>(
  "WorkspaceRemoteTargetError",
)(
  {
    name: Schema.Literal("WorkspaceRemoteTargetError"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 400 },
) {}

export class ApiWorkspaceRemoteTargetUnauthorizedError extends Schema.ErrorClass<ApiWorkspaceRemoteTargetUnauthorizedError>(
  "WorkspaceRemoteTargetUnauthorizedError",
)(
  {
    name: Schema.Literal("WorkspaceRemoteTargetUnauthorizedError"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 403 },
) {}

export const WorkspacePaths = {
  adapters: `${root}/adapter`,
  list: root,
  syncList: `${root}/sync-list`,
  status: `${root}/status`,
  remove: `${root}/:id`,
  warp: `${root}/warp`,
  remoteHosts: `${root}/remote/host`,
  remotePairing: `${root}/remote/pairing`,
  remotePairingRemove: `${root}/remote/pairing/:pairingID`,
  remoteSshValidate: `${root}/remote/ssh/validate`,
  remoteSelect: `${root}/remote/select`,
  remoteTarget: `${root}/remote/target`,
} as const

export const WorkspaceApi = HttpApi.make("workspace")
  .add(
    HttpApiGroup.make("workspace")
      .add(
        HttpApiEndpoint.get("adapters", WorkspacePaths.adapters, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(WorkspaceAdapterEntry), "Workspace adapters"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.adapter.list",
            summary: "List workspace adapters",
            description: "List all available workspace adapters for the current project.",
          }),
        ),
        HttpApiEndpoint.get("list", WorkspacePaths.list, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(Workspace.Info), "Workspaces"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.list",
            summary: "List workspaces",
            description: "List all workspaces.",
          }),
        ),
        HttpApiEndpoint.post("create", WorkspacePaths.list, {
          query: WorkspaceRoutingQuery,
          payload: CreatePayload,
          success: described(Workspace.Info, "Workspace created"),
          error: [ApiWorkspaceCreateError, HttpApiError.BadRequest],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.create",
            summary: "Create workspace",
            description: "Create a workspace for the current project.",
          }),
        ),
        HttpApiEndpoint.post("syncList", WorkspacePaths.syncList, {
          query: WorkspaceRoutingQuery,
          success: described(HttpApiSchema.NoContent, "Workspace list synced"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.syncList",
            summary: "Sync workspace list",
            description: "Register missing workspaces returned by workspace adapters.",
          }),
        ),
        HttpApiEndpoint.get("status", WorkspacePaths.status, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(Workspace.ConnectionStatus), "Workspace status"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.status",
            summary: "Workspace status",
            description: "Get connection status for workspaces in the current project.",
          }),
        ),
        HttpApiEndpoint.delete("remove", WorkspacePaths.remove, {
          params: { id: Workspace.Info.fields.id },
          query: WorkspaceRoutingQuery,
          success: described(Schema.UndefinedOr(Workspace.Info), "Workspace removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remove",
            summary: "Remove workspace",
            description: "Remove an existing workspace.",
          }),
        ),
        HttpApiEndpoint.post("warp", WorkspacePaths.warp, {
          query: WorkspaceRoutingQuery,
          payload: WarpPayload,
          success: described(HttpApiSchema.NoContent, "Session warped"),
          error: [ApiWorkspaceWarpError, ApiVcsApplyError, ApiNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.warp",
            summary: "Warp session into workspace",
            description: "Move a session's sync history into the target workspace, or detach it to the local project.",
          }),
        ),
        HttpApiEndpoint.get("remoteHosts", WorkspacePaths.remoteHosts, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(RemotePairedHostWire), "Paired remote hosts"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remote.host.list",
            summary: "List paired remote hosts",
            description: "List paired hosts and their workspace pairings available to the current instance.",
          }),
        ),
        HttpApiEndpoint.post("remotePairing", WorkspacePaths.remotePairing, {
          query: WorkspaceRoutingQuery,
          payload: RemotePairingCreatePayload,
          success: described(RemotePairingWire, "Remote pairing created"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remote.pairing.create",
            summary: "Create remote pairing",
            description: "Create or refresh a persisted device pairing for one remote workspace selection.",
          }),
        ),
        HttpApiEndpoint.delete("remotePairingRemove", WorkspacePaths.remotePairingRemove, {
          params: { pairingID: RemotePairing.fields.id },
          query: WorkspaceRoutingQuery,
          success: described(HttpApiSchema.NoContent, "Remote pairing revoked"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remote.pairing.revoke",
            summary: "Revoke remote pairing",
            description: "Revoke one persisted remote device pairing.",
          }),
        ),
        HttpApiEndpoint.post("remoteSshValidate", WorkspacePaths.remoteSshValidate, {
          query: WorkspaceRoutingQuery,
          payload: RemoteWorkspaceSshInput,
          success: described(RemoteWorkspaceSsh, "SSH workspace validated"),
          error: [ApiWorkspaceRemoteSshValidationError, HttpApiError.BadRequest],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remote.ssh.validate",
            summary: "Validate SSH workspace",
            description:
              "Validate an SSH workspace selection against an authenticated desktop supervisor target registration.",
          }),
        ),
        HttpApiEndpoint.post("remoteSelect", WorkspacePaths.remoteSelect, {
          query: WorkspaceRoutingQuery,
          payload: RemoteWorkspaceSelectInput,
          success: described(Schema.UndefinedOr(RemotePairingRecordWire), "Remote workspace selected"),
          error: ApiWorkspaceRemoteSelectError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remote.select",
            summary: "Select remote workspace",
            description:
              "Activate one persisted remote workspace selection only after a fail-closed supervisor target is available.",
          }),
        ),
        HttpApiEndpoint.post("remoteTarget", WorkspacePaths.remoteTarget, {
          query: WorkspaceRoutingQuery,
          payload: RemoteWorkspaceTargetPayload,
          success: described(HttpApiSchema.NoContent, "Remote workspace target registered"),
          error: [ApiWorkspaceRemoteTargetError, ApiWorkspaceRemoteTargetUnauthorizedError, HttpApiError.BadRequest],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.workspace.remote.target.register",
            summary: "Register remote workspace target",
            description:
              "Authenticated desktop supervisor handoff that registers the exact validated target for one remote workspace selection.",
          }),
        ),
      )
      .annotateMerge(OpenApi.annotations({ title: "workspace", description: "Experimental HttpApi workspace routes." }))
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "slopcode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )
