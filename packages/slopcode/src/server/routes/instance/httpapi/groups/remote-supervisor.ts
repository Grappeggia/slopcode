import { RemotePairingRecordWire, RemoteWorkspaceTargetPayload } from "../../../../../../../protocol/src/remote"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { HttpApiSchema } from "effect/unstable/httpapi"
import { described } from "./metadata"

export const RemoteSupervisorPaths = {
  pairings: "/experimental/remote/supervisor/pairings",
  target: "/experimental/remote/supervisor/target",
} as const

export const RemoteSupervisorApi = HttpApi.make("remote-supervisor").add(
  HttpApiGroup.make("remote-supervisor")
    .add(
      HttpApiEndpoint.get("pairings", RemoteSupervisorPaths.pairings, {
        success: described(Schema.Array(RemotePairingRecordWire), "Pending remote pairings"),
        error: HttpApiError.Forbidden,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "experimental.remote.supervisor.pairings",
          summary: "List remote pairings for a supervisor",
          description: "List redacted remote pairings across instance scopes for an authenticated desktop supervisor.",
        }),
      ),
      HttpApiEndpoint.post("target", RemoteSupervisorPaths.target, {
        payload: RemoteWorkspaceTargetPayload,
        success: described(HttpApiSchema.NoContent, "Remote target registered"),
        error: [HttpApiError.BadRequest, HttpApiError.Forbidden],
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "experimental.remote.supervisor.target",
          summary: "Register a remote target for a pairing",
          description: "Bind a validated loopback target to an exact pairing without relying on an instance-directory selector.",
        }),
      ),
    )
    .annotateMerge(OpenApi.annotations({ title: "remote supervisor", description: "Authenticated desktop supervisor handoff routes." })),
)
