import { Agent } from "@opencode-ai/schema/agent"
import { Location } from "@opencode-ai/schema/location"
import { Permission } from "@opencode-ai/schema/permission"
import { PermissionSaved } from "@opencode-ai/schema/permission-saved"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { Context, Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { PermissionNotFoundError, SessionNotFoundError } from "../errors"
import { LocationQuery, locationQueryOpenApi } from "./location"

export const PermissionSavedQuery = Schema.Struct({
  scope: Schema.Literals(["project", "global"]).pipe(Schema.optional),
  projectID: Project.ID.pipe(Schema.optional),
})

export const makePermissionGroup = <
  LocationId extends HttpApiMiddleware.AnyId,
  LocationService,
  SessionLocationId extends HttpApiMiddleware.AnyId,
  SessionLocationService,
>(
  locationMiddleware: Context.Key<LocationId, LocationService>,
  sessionLocationMiddleware: Context.Key<SessionLocationId, SessionLocationService>,
) =>
  HttpApiGroup.make("server.permission")
    .add(
      HttpApiEndpoint.get("permission.request.list", "/api/permission/request", {
        query: LocationQuery,
        success: Location.response(Schema.Array(Permission.Request)),
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.permission.request.list",
            summary: "List pending permission requests",
            description: "Retrieve pending permission requests for a location.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("permission.saved.list", "/api/permission/saved", {
        query: PermissionSavedQuery,
        success: Schema.Struct({ data: Schema.Array(PermissionSaved.Info) }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "v2.permission.saved.list",
          summary: "List saved permissions",
          description: "Retrieve saved permissions for the current location or an explicit project/global scope.",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.delete("permission.saved.remove", "/api/permission/saved/:id", {
        params: { id: PermissionSaved.ID },
        query: PermissionSavedQuery,
        success: HttpApiSchema.NoContent,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "v2.permission.saved.remove",
          summary: "Remove saved permission",
          description: "Remove a saved permission by ID from the current location or an explicit project/global scope.",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("permission.saved.clear", "/api/permission/saved/clear", {
        payload: Schema.Union([
          Schema.Struct({ scope: Schema.Literal("global"), confirm: Schema.Literal(true) }),
          Schema.Struct({
            scope: Schema.Literal("project"),
            projectID: Project.ID.pipe(Schema.optional),
            confirm: Schema.Literal(true),
          }),
        ]),
        success: Schema.Struct({ data: Schema.Number }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "v2.permission.saved.clear",
          summary: "Clear saved permissions",
          description: "Clear one explicitly confirmed saved permission scope.",
        }),
      ),
    )
    // Effect applies group middleware only to endpoints already added; session endpoints use session placement below.
    .middleware(locationMiddleware)
    .add(
      HttpApiEndpoint.get("session.permission.saved.list", "/api/session/:sessionID/permission/saved", {
        params: { sessionID: Session.ID },
        success: Schema.Struct({ data: Schema.Array(PermissionSaved.Info) }),
        error: SessionNotFoundError,
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.saved.list",
            summary: "List session permission grants",
            description: "Retrieve exact grants owned by one session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.delete("session.permission.saved.remove", "/api/session/:sessionID/permission/saved/:id", {
        params: { sessionID: Session.ID, id: PermissionSaved.ID },
        success: HttpApiSchema.NoContent,
        error: SessionNotFoundError,
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.saved.remove",
            summary: "Remove session permission grant",
            description: "Remove an exact grant owned by one session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("session.permission.saved.clear", "/api/session/:sessionID/permission/saved/clear", {
        params: { sessionID: Session.ID },
        payload: Schema.Struct({ confirm: Schema.Literal(true) }),
        success: Schema.Struct({ data: Schema.Number }),
        error: SessionNotFoundError,
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.saved.clear",
            summary: "Clear session permission grants",
            description: "Clear every exact grant owned by one explicitly confirmed session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("session.permission.create", "/api/session/:sessionID/permission", {
        params: { sessionID: Session.ID },
        payload: Schema.Struct({
          id: Permission.ID.pipe(Schema.optional),
          action: Permission.Request.fields.action,
          resources: Permission.Request.fields.resources,
          save: Permission.Request.fields.save,
          metadata: Permission.Request.fields.metadata,
          source: Permission.Request.fields.source,
          agent: Agent.ID.pipe(Schema.optional),
        }),
        success: Schema.Struct({
          data: Schema.Struct({ id: Permission.ID, effect: Permission.Effect }),
        }),
        error: SessionNotFoundError,
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.create",
            summary: "Create permission request",
            description: "Evaluate and, when approval is required, create a permission request for a session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("session.permission.list", "/api/session/:sessionID/permission", {
        params: { sessionID: Session.ID },
        success: Schema.Struct({ data: Schema.Array(Permission.Request) }),
        error: SessionNotFoundError,
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.list",
            summary: "List session permission requests",
            description: "Retrieve pending permission requests owned by a session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("session.permission.get", "/api/session/:sessionID/permission/:requestID", {
        params: { sessionID: Session.ID, requestID: Permission.ID },
        success: Schema.Struct({ data: Permission.Request }),
        error: [SessionNotFoundError, PermissionNotFoundError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.get",
            summary: "Get permission request",
            description: "Retrieve a pending permission request owned by a session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("session.permission.reply", "/api/session/:sessionID/permission/:requestID/reply", {
        params: { sessionID: Session.ID, requestID: Permission.ID },
        payload: Schema.Struct({
          reply: Permission.Reply,
          message: Schema.String.pipe(Schema.optional),
        }),
        success: HttpApiSchema.NoContent,
        error: [SessionNotFoundError, PermissionNotFoundError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.permission.reply",
            summary: "Reply to pending permission request",
            description: "Respond to a pending permission request owned by a session.",
          }),
        ),
    )
    .annotateMerge(OpenApi.annotations({ title: "permissions", description: "Experimental permission routes." }))
