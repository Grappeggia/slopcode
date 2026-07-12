import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionControl } from "@slopcode-ai/core/session/control"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { Effect, Layer } from "effect"
import { layer as locationLayer } from "./groups/location"
import { sessionLocationLayer } from "./middleware/session-location"
import { MessageHandler } from "./handlers/message"
import { ModelHandler } from "./handlers/model"
import { ProviderHandler } from "./handlers/provider"
import { SessionHandler } from "./handlers/session"
import { PermissionHandler } from "./handlers/permission"
import { FileSystemHandler } from "./handlers/fs"
import { CommandHandler } from "./handlers/command"
import { SkillHandler } from "./handlers/skill"
import { EventHandler } from "./handlers/event"
import { AgentHandler } from "./handlers/agent"
import { HealthHandler } from "./handlers/health"
import { QuestionHandler } from "./handlers/question"
import { ReferenceHandler } from "./handlers/reference"
import * as SessionExecutionLocal from "@slopcode-ai/core/session/execution/local"
import { LocationHandler } from "./handlers/location"
import { IntegrationHandler } from "./handlers/integration"
import { CredentialHandler } from "./handlers/credential"
import { Credential } from "@slopcode-ai/core/credential"
import { ProjectCopyHandler } from "./handlers/project-copy"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionGraph } from "./session-graph"
import { SessionExecutionStatus } from "@slopcode-ai/core/session/execution-status"

const store = SessionStore.layer
const execution = SessionExecutionLocal.layer.pipe(Layer.provide(store))
const status = SessionExecutionStatus.layer
export const sessionServices = Layer.mergeAll(
  SessionV2.layer.pipe(Layer.provide(execution), Layer.provide(store), Layer.provide(status)),
  SessionProjector.layer,
  status,
).pipe(
  Layer.orDie,
)
export const isolatedSessionServices = Layer.mergeAll(
  Layer.fresh(SessionV2.layer).pipe(Layer.provide(execution), Layer.provide(store), Layer.provide(status)),
  SessionProjector.layer,
  status,
).pipe(
  Layer.orDie,
)

export const rawHandlers = Layer.mergeAll(
  HealthHandler,
  LocationHandler,
  AgentHandler,
  SessionHandler,
  MessageHandler,
  ModelHandler,
  ProviderHandler,
  IntegrationHandler,
  CredentialHandler,
  PermissionHandler,
  FileSystemHandler,
  CommandHandler,
  SkillHandler,
  EventHandler,
  QuestionHandler,
  ReferenceHandler,
  ProjectCopyHandler,
).pipe(
  Layer.provide(sessionLocationLayer),
  Layer.provide(locationLayer),
  Layer.provide(PermissionSaved.defaultLayer),
  Layer.provide(Credential.defaultLayer),
)

const graph = Layer.effect(
  SessionGraph.Service,
  SessionV2.Service.use((session) =>
    SessionControl.Service.use((control) =>
      SessionRuntime.Service.use((runtime) => Effect.succeed(SessionGraph.Service.of({ session, control, runtime }))),
    ),
  ),
).pipe(
  Layer.provide(SessionControl.layer),
  Layer.provide(sessionServices),
  Layer.provide(SessionRuntime.defaultLayer),
)

export const handlers = rawHandlers.pipe(
  Layer.provide(graph),
  Layer.provide(SessionRuntime.defaultLayer),
  Layer.provide(ProjectV2.defaultLayer),
  Layer.provide(EventV2.defaultLayer),
  Layer.provide(Database.defaultLayer),
)
