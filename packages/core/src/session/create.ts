export * as SessionCreate from "./create"

import { DateTime, Effect } from "effect"
import type { AgentV2 } from "../agent"
import type { EventV2 } from "../event"
import { InstallationVersion } from "../installation/version"
import type { Location } from "../location"
import type { ModelV2 } from "../model"
import type { ProjectV2 } from "../project"
import type { RelativePath } from "../schema"
import { Slug } from "../util/slug"
import { SessionEvent } from "./event"
import type { SessionRuntime } from "./runtime"
import type { SessionSchema } from "./schema"
import type { SessionStore } from "./store"

export class AlreadyProjected extends Error {}

export const eventID = (id: SessionSchema.ID) => `evt_session_created_${id}` as EventV2.ID

export const create = Effect.fn("SessionCreate.create")(function* (
  events: EventV2.Interface,
  store: SessionStore.Interface,
  input: {
    readonly id: SessionSchema.ID
    readonly parentID?: SessionSchema.ID
    readonly projectID: ProjectV2.ID
    readonly location: Location.Ref
    readonly subpath?: RelativePath
    readonly title: string
    readonly agent?: AgentV2.ID
    readonly model?: ModelV2.Ref
    readonly metadata?: Record<string, unknown>
    readonly runtime?: SessionRuntime.Owner
  },
) {
  const recorded = yield* store.get(input.id)
  if (recorded) return recorded
  const timestamp = yield* DateTime.now
  yield* events
    .publish(
      SessionEvent.Created,
      {
        sessionID: input.id,
        timestamp,
        parentID: input.parentID,
        projectID: input.projectID,
        location: input.location,
        subpath: input.subpath,
        title: input.title,
        slug: Slug.create(),
        version: InstallationVersion,
        agent: input.agent,
        model: input.model,
        metadata: input.metadata,
        runtime: input.runtime ?? "v1",
      },
      { id: eventID(input.id), location: input.location },
    )
    .pipe(Effect.catchDefect((defect) => (defect instanceof AlreadyProjected ? Effect.void : Effect.die(defect))))
  const session = yield* store.get(input.id)
  return session ? session : yield* Effect.die(`Session not found after creation: ${input.id}`)
})
