export * as PermissionSaved from "./permission-saved"

import { Schema } from "effect"
import { ascending } from "./identifier"
import { ProjectID } from "./project-id"
import { SessionID } from "./session-id"
import { statics } from "./schema"

export const ID = Schema.String.pipe(
  Schema.brand("PermissionSaved.ID"),
  statics((schema) => ({ create: () => schema.make("psv_" + ascending()) })),
)
export type ID = typeof ID.Type

export const DirectoryID = Schema.String.pipe(Schema.brand("PermissionSaved.DirectoryID"))
export type DirectoryID = typeof DirectoryID.Type

export const Scope = Schema.Literals(["project", "session", "global", "directory"]).annotate({
  identifier: "PermissionSaved.Scope",
})
export type Scope = typeof Scope.Type

export const Match = Schema.Literals(["pattern", "exact"]).annotate({ identifier: "PermissionSaved.Match" })
export type Match = typeof Match.Type

export const Info = Schema.Struct({
  id: ID,
  projectID: ProjectID,
  sessionID: SessionID.pipe(Schema.optional),
  directoryID: DirectoryID.pipe(Schema.optional),
  scope: Scope,
  match: Match,
  action: Schema.String,
  resource: Schema.String,
})
  .check(
    Schema.makeFilter((value) => {
      if (value.scope === "project")
        return value.match === "pattern" && value.sessionID === undefined && value.directoryID === undefined
          ? undefined
          : "Invalid project permission"
      if (value.scope === "global")
        return value.match === "exact" &&
          value.sessionID === undefined &&
          value.directoryID === undefined &&
          value.projectID === ProjectID.global
          ? undefined
          : "Invalid global permission"
      if (value.scope === "directory")
        return value.match === "pattern" &&
          value.sessionID === undefined &&
          value.directoryID !== undefined &&
          value.projectID === ProjectID.global
          ? undefined
          : "Invalid directory permission"
      return value.match === "exact" && value.sessionID !== undefined && value.directoryID === undefined
        ? undefined
        : "Invalid session permission"
    }),
  )
  .annotate({ identifier: "PermissionSaved.Info" })
export interface Info extends Schema.Schema.Type<typeof Info> {}
