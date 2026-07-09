import { Memory } from "@/memory/memory"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQueryFields } from "../middleware/workspace-routing"
import { described } from "./metadata"
import { QueryBoolean } from "./query"

export const ListQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  includeDisabled: Schema.optional(QueryBoolean),
})

export const MemoryPaths = {
  list: "/memory",
  create: "/memory",
  update: "/memory/:memoryID",
  remove: "/memory/:memoryID",
} as const

export const MemoryApi = HttpApi.make("memory")
  .add(
    HttpApiGroup.make("memory")
      .add(
        HttpApiEndpoint.get("list", MemoryPaths.list, {
          query: ListQuery,
          success: described(Schema.Array(Memory.Info), "Stored memories"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.list",
            summary: "List memories",
            description: "List local memories available to the current project.",
          }),
        ),
        HttpApiEndpoint.post("create", MemoryPaths.create, {
          query: Schema.Struct(WorkspaceRoutingQueryFields),
          payload: Memory.CreateInput,
          success: described(Memory.Info, "Created memory"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.create",
            summary: "Create memory",
            description: "Create a local memory for the current project or globally.",
          }),
        ),
        HttpApiEndpoint.patch("update", MemoryPaths.update, {
          params: { memoryID: Memory.ID },
          query: Schema.Struct(WorkspaceRoutingQueryFields),
          payload: Memory.UpdateInput,
          success: described(Memory.Info, "Updated memory"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.update",
            summary: "Update memory",
            description: "Update the contents or enabled state of a local memory.",
          }),
        ),
        HttpApiEndpoint.delete("remove", MemoryPaths.remove, {
          params: { memoryID: Memory.ID },
          query: Schema.Struct(WorkspaceRoutingQueryFields),
          success: described(Schema.Boolean, "Deleted memory"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.delete",
            summary: "Delete memory",
            description: "Delete a local memory.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "memory",
          description: "Local memory management routes.",
        }),
      )
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
