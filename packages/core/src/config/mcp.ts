export * as ConfigMCP from "./mcp"

import { Schema } from "effect"
import { PositiveInt } from "../schema"

export class Local extends Schema.Class<Local>("ConfigV2.MCP.Local")({
  type: Schema.Literal("local"),
  command: Schema.String.pipe(Schema.Array),
  cwd: Schema.String.pipe(Schema.optional).annotate({
    description: "Working directory for the MCP server process. Relative paths resolve from the workspace directory.",
  }),
  environment: Schema.Record(Schema.String, Schema.String).pipe(Schema.optional),
  disabled: Schema.Boolean.pipe(Schema.optional),
  timeout: PositiveInt.pipe(Schema.optional),
}) {}

const redirect = Schema.String.check(
  Schema.makeFilter((value) => {
    try {
      const url = new URL(value)
      return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname && !url.username && !url.password && !url.hash
        ? undefined
        : "MCP OAuth redirect URI is invalid"
    } catch {
      return "MCP OAuth redirect URI is invalid"
    }
  }),
)

export const OAuth = Schema.Struct({
  client_id: Schema.NonEmptyString.pipe(Schema.optional),
  client_secret: Schema.String.pipe(Schema.optional),
  scope: Schema.String.pipe(Schema.optional),
  callback_port: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 })).pipe(Schema.optional),
  redirect_uri: redirect.pipe(Schema.optional),
}).check(
  Schema.makeFilter((value) =>
    value.client_secret === undefined || value.client_id !== undefined
      ? undefined
      : "MCP OAuth client ID is required when a client secret is configured",
  ),
)

export class Remote extends Schema.Class<Remote>("ConfigV2.MCP.Remote")({
  type: Schema.Literal("remote"),
  url: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String).pipe(Schema.optional),
  oauth: Schema.Union([OAuth, Schema.Literal(false)]).pipe(Schema.optional),
  disabled: Schema.Boolean.pipe(Schema.optional),
  timeout: PositiveInt.pipe(Schema.optional),
}) {}

export const Server = Schema.Union([Local, Remote]).pipe(Schema.toTaggedUnion("type"))

export class Info extends Schema.Class<Info>("ConfigV2.MCP")({
  timeout: PositiveInt.pipe(Schema.optional),
  servers: Schema.Record(Schema.String, Server).pipe(Schema.optional),
}) {}
