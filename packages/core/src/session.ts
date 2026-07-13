export * as SessionV2 from "./session"
export * from "./session/schema"

import { Cause, DateTime, Effect, Layer, Schema, Context, Stream } from "effect"
import { and, asc, desc, eq, gt, like, lt, or, type SQL } from "drizzle-orm"
import { ProjectV2 } from "./project"
import { WorkspaceV2 } from "./workspace"
import { ModelV2 } from "./model"
import { Location } from "./location"
import { SessionMessage } from "./session/message"
import { Prompt } from "./session/prompt"
import { EventV2 } from "./event"
import { Database } from "./database/database"
import { SessionProjector } from "./session/projector"
import { SessionMessageTable, SessionTable } from "./session/sql"
import { SessionSchema } from "./session/schema"
import { AbsolutePath, PositiveInt, RelativePath } from "./schema"
import { AgentV2 } from "./agent"
import { SessionV1 } from "./v1/session"
import { ProjectTable } from "./project/sql"
import path from "path"
import { fromRow } from "./session/info"
import { SessionRunner } from "./session/runner/index"
import { SessionStore } from "./session/store"
import { SessionExecution } from "./session/execution"
import { logFailure } from "./session/logging"
import { MessageDecodeError } from "./session/error"
import { SessionEvent } from "./session/event"
import { SessionInput } from "./session/input"
import { SessionRuntime } from "./session/runtime"
import { LocationServiceMap } from "./location-layer"
import { PluginBoot } from "./plugin/boot"
import { SkillV2 } from "./skill"
import { SessionTask } from "./session/task"
import { SessionCreate } from "./session/create"
import { SessionRunnerModel } from "./session/runner/model"
import { SessionHistory } from "./session/history"

// get project -> project.locations
//
// get all sessions
//

// - by project
//   - by subpath
// - by workspace (home is special)

export const ListAnchor = Schema.Struct({
  id: SessionSchema.ID,
  time: Schema.Finite,
  direction: Schema.Literals(["previous", "next"]),
})
export type ListAnchor = typeof ListAnchor.Type

const ListInputBase = {
  workspaceID: WorkspaceV2.ID.pipe(Schema.optional),
  search: Schema.String.pipe(Schema.optional),
  limit: PositiveInt.pipe(Schema.optional),
  order: Schema.Literals(["asc", "desc"]).pipe(Schema.optional),
  anchor: ListAnchor.pipe(Schema.optional),
}

const ListDirectoryInput = Schema.Struct({
  ...ListInputBase,
  directory: AbsolutePath,
})

const ListProjectInput = Schema.Struct({
  ...ListInputBase,
  project: ProjectV2.ID,
  subpath: RelativePath.pipe(Schema.optional),
})

const ListAllInput = Schema.Struct(ListInputBase)

export const ListInput = Schema.Union([ListDirectoryInput, ListProjectInput, ListAllInput])
export type ListInput = typeof ListInput.Type

type CreateInput = {
  id?: SessionSchema.ID
  agent?: AgentV2.ID
  model?: ModelV2.Ref
  location: Location.Ref
  runtime?: SessionRuntime.Owner
}

export type CompactInput = {
  id?: SessionMessage.ID
  sessionID: SessionSchema.ID
  prompt?: Prompt
}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Session.NotFoundError", {
  sessionID: SessionSchema.ID,
}) {}

export { ContextSnapshotDecodeError, MessageDecodeError } from "./session/error"

export class PromptConflictError extends Schema.TaggedErrorClass<PromptConflictError>()("Session.PromptConflictError", {
  sessionID: SessionSchema.ID,
  messageID: SessionMessage.ID,
}) {}

export class CompactionConflictError extends Schema.TaggedErrorClass<CompactionConflictError>()(
  "Session.CompactionConflictError",
  {
    sessionID: SessionSchema.ID,
    messageID: SessionMessage.ID,
  },
) {}

export class ShellConflictError extends Schema.TaggedErrorClass<ShellConflictError>()("Session.ShellConflictError", {
  sessionID: SessionSchema.ID,
  messageID: SessionMessage.ID,
}) {}

export class CompactionPromptUnsupportedError extends Schema.TaggedErrorClass<CompactionPromptUnsupportedError>()(
  "Session.CompactionPromptUnsupportedError",
  {
    message: Schema.String,
  },
) {}

export class CompactionFailedError extends Schema.TaggedErrorClass<CompactionFailedError>()(
  "Session.CompactionFailedError",
  {
    sessionID: SessionSchema.ID,
    messageID: SessionMessage.ID,
    reason: SessionEvent.Compaction.Failed.data.fields.reason,
    message: Schema.String,
  },
) {}

export class AgentUnavailableError extends Schema.TaggedErrorClass<AgentUnavailableError>()(
  "Session.AgentUnavailableError",
  {
    agent: AgentV2.ID,
    available: Schema.Array(AgentV2.ID),
  },
) {}

export class SkillNotFoundError extends Schema.TaggedErrorClass<SkillNotFoundError>()("Session.SkillNotFoundError", {
  skill: Schema.String,
  available: Schema.Array(Schema.String),
}) {}

export class ModelHistoryIncompatibleError extends Schema.TaggedErrorClass<ModelHistoryIncompatibleError>()(
  "Session.ModelHistoryIncompatibleError",
  {
    sessionID: SessionSchema.ID,
    model: ModelV2.Ref,
    protocol: Schema.String,
    feature: Schema.Literal("custom-tools"),
  },
) {}

export type Error =
  | NotFoundError
  | MessageDecodeError
  | PromptConflictError
  | ShellConflictError
  | CompactionConflictError
  | CompactionPromptUnsupportedError
  | CompactionFailedError
  | AgentUnavailableError
  | SkillNotFoundError
  | ModelHistoryIncompatibleError

export interface Interface {
  readonly list: (input?: ListInput) => Effect.Effect<SessionSchema.Info[]>
  readonly create: (input: CreateInput) => Effect.Effect<SessionSchema.Info>
  readonly get: (sessionID: SessionSchema.ID) => Effect.Effect<SessionSchema.Info, NotFoundError>
  readonly messages: (input: {
    sessionID: SessionSchema.ID
    limit?: number
    order?: "asc" | "desc"
    cursor?: {
      id: SessionMessage.ID
      direction: "previous" | "next"
    }
  }) => Effect.Effect<SessionMessage.Message[], NotFoundError | MessageDecodeError>
  readonly message: (input: {
    sessionID: SessionSchema.ID
    messageID: SessionMessage.ID
  }) => Effect.Effect<SessionMessage.Message | undefined>
  readonly context: (
    sessionID: SessionSchema.ID,
  ) => Effect.Effect<SessionMessage.Message[], NotFoundError | MessageDecodeError>
  readonly events: (input: {
    sessionID: SessionSchema.ID
    after?: EventV2.Cursor
  }) => Stream.Stream<EventV2.CursorEvent<SessionEvent.DurableEvent>, NotFoundError>
  readonly switchAgent: <E = never>(
    input: {
      sessionID: SessionSchema.ID
      agent: string
    },
    guard?: Effect.Effect<void, E>,
  ) => Effect.Effect<void, NotFoundError | AgentUnavailableError | E>
  readonly switchModel: <E = never>(
    input: {
      sessionID: SessionSchema.ID
      model: ModelV2.Ref
    },
    guard?: Effect.Effect<void, E>,
  ) => Effect.Effect<
    void,
    NotFoundError | MessageDecodeError | ModelHistoryIncompatibleError | SessionRunnerModel.Error | E
  >
  readonly prompt: <E = never>(
    input: {
      id?: SessionMessage.ID
      sessionID: SessionSchema.ID
      prompt: Prompt
      delivery?: SessionInput.Delivery
      resume?: boolean
    },
    guard?: Effect.Effect<void, E>,
  ) => Effect.Effect<SessionInput.Admitted, NotFoundError | PromptConflictError | E>
  readonly shell: <E = never>(
    input: {
      id?: SessionMessage.ID
      sessionID: SessionSchema.ID
      command: string
      resume?: boolean
    },
    guard?: Effect.Effect<void, E>,
  ) => Effect.Effect<void, NotFoundError | ShellConflictError | E>
  readonly skill: <E = never>(
    input: {
      id?: SessionMessage.ID
      sessionID: SessionSchema.ID
      skill: string
      resume?: boolean
    },
    guard?: Effect.Effect<void, E>,
  ) => Effect.Effect<SessionInput.Admitted, NotFoundError | SkillNotFoundError | PromptConflictError | E>
  readonly compact: <E = never>(
    input: CompactInput,
    guard?: Effect.Effect<void, E>,
  ) => Effect.Effect<
    void,
    NotFoundError | CompactionConflictError | CompactionPromptUnsupportedError | CompactionFailedError | E
  >
  readonly wait: (id: SessionSchema.ID) => Effect.Effect<void, NotFoundError | SessionRunner.RunError>
  readonly resume: (sessionID: SessionSchema.ID) => Effect.Effect<void, NotFoundError | SessionRunner.RunError>
  readonly interrupt: <E = never>(sessionID: SessionSchema.ID, guard?: Effect.Effect<void, E>) => Effect.Effect<void, E>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/Session") {}

class MutationGuardFailure {
  constructor(readonly error: unknown) {}
}

const guardedCommit = <A, E, R, G>(
  mutation: (commit: Effect.Effect<void>) => Effect.Effect<A, E, R>,
  guard: Effect.Effect<void, G>,
): Effect.Effect<A, E | G, R> =>
  mutation(guard.pipe(Effect.catch((error) => Effect.die(new MutationGuardFailure(error))))).pipe(
    Effect.catchDefect((defect) =>
      defect instanceof MutationGuardFailure ? Effect.fail(defect.error as G) : Effect.die(defect),
    ),
  )

const guardedCheck = <G>(db: Database.Interface["db"], guard: Effect.Effect<void, G>) =>
  guardedCommit((commit) => db.transaction(() => commit, { behavior: "immediate" }).pipe(Effect.orDie), guard)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const events = yield* EventV2.Service
    const projects = yield* ProjectV2.Service
    const execution = yield* SessionExecution.Service
    const store = yield* SessionStore.Service
    const locations = yield* LocationServiceMap
    const decodeMessage = Schema.decodeUnknownEffect(SessionMessage.Message)
    const isDurableSessionEvent = Schema.is(SessionEvent.Durable)
    const enqueueWake = (admitted: { readonly sessionID: SessionSchema.ID; readonly admittedSeq: number }) =>
      execution.wake(admitted.sessionID, admitted.admittedSeq).pipe(
        Effect.tapCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.void
            : logFailure("Failed to wake Session", admitted.sessionID, cause),
        ),
        Effect.ignore,
        Effect.asVoid,
      )

    const decode = (row: typeof SessionMessageTable.$inferSelect) =>
      decodeMessage({ ...row.data, id: row.id, type: row.type }).pipe(
        Effect.mapError(
          () =>
            new MessageDecodeError({
              sessionID: SessionSchema.ID.make(row.session_id),
              messageID: SessionMessage.ID.make(row.id),
            }),
        ),
      )

    const result = Service.of({
      create: Effect.fn("V2Session.create")(function* (input) {
        const sessionID = input.id ?? SessionSchema.ID.create()
        const recorded = yield* store.get(sessionID)
        if (recorded) return recorded
        const project = yield* projects.resolve(input.location.directory)
        yield* db
          .insert(ProjectTable)
          .values({ id: project.id, worktree: project.directory, vcs: project.vcs?.type, sandboxes: [] })
          .onConflictDoNothing()
          .run()
          .pipe(Effect.orDie)
        const now = Date.now()
        return yield* SessionCreate.create(events, store, {
          id: sessionID,
          projectID: project.id,
          location: input.location,
          subpath: RelativePath.make(path.relative(project.directory, input.location.directory).replaceAll("\\", "/")),
          title: `New session - ${new Date(now).toISOString()}`,
          agent: input.agent,
          model: input.model,
          runtime: input.runtime,
        })
      }),
      get: Effect.fn("V2Session.get")(function* (sessionID) {
        const session = yield* store.get(sessionID)
        if (!session) return yield* new NotFoundError({ sessionID })
        return session
      }),
      list: Effect.fn("V2Session.list")(function* (input = {}) {
        const direction = input.anchor?.direction ?? "next"
        const requestedOrder = input.order ?? "desc"
        const order = direction === "previous" ? (requestedOrder === "asc" ? "desc" : "asc") : requestedOrder
        const sortColumn = SessionTable.time_created
        const conditions: SQL[] = []
        if ("directory" in input) conditions.push(eq(SessionTable.directory, input.directory))
        if (input.workspaceID) conditions.push(eq(SessionTable.workspace_id, input.workspaceID))
        if ("project" in input) conditions.push(eq(SessionTable.project_id, input.project))
        if (input.search) conditions.push(like(SessionTable.title, `%${input.search}%`))
        if (input.anchor) {
          conditions.push(
            order === "asc"
              ? or(
                  gt(sortColumn, input.anchor.time),
                  and(eq(sortColumn, input.anchor.time), gt(SessionTable.id, input.anchor.id)),
                )!
              : or(
                  lt(sortColumn, input.anchor.time),
                  and(eq(sortColumn, input.anchor.time), lt(SessionTable.id, input.anchor.id)),
                )!,
          )
        }
        const query = db
          .select()
          .from(SessionTable)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(
            order === "asc" ? asc(sortColumn) : desc(sortColumn),
            order === "asc" ? asc(SessionTable.id) : desc(SessionTable.id),
          )
        const rows = yield* (input.limit === undefined ? query.all() : query.limit(input.limit).all()).pipe(
          Effect.orDie,
        )
        return (direction === "previous" ? rows.toReversed() : rows).map((row) => fromRow(row))
      }),
      messages: Effect.fn("V2Session.messages")(function* (input) {
        yield* result.get(input.sessionID)
        const direction = input.cursor?.direction ?? "next"
        const requestedOrder = input.order ?? "desc"
        const order = direction === "previous" ? (requestedOrder === "asc" ? "desc" : "asc") : requestedOrder
        const anchor = input.cursor
          ? yield* db
              .select({ seq: SessionMessageTable.seq })
              .from(SessionMessageTable)
              .where(
                and(eq(SessionMessageTable.session_id, input.sessionID), eq(SessionMessageTable.id, input.cursor.id)),
              )
              .get()
              .pipe(Effect.orDie)
          : undefined
        if (input.cursor && !anchor) return []
        const boundary = anchor
          ? order === "asc"
            ? gt(SessionMessageTable.seq, anchor.seq)
            : lt(SessionMessageTable.seq, anchor.seq)
          : undefined
        const where = boundary
          ? and(eq(SessionMessageTable.session_id, input.sessionID), boundary)
          : eq(SessionMessageTable.session_id, input.sessionID)
        const query = db
          .select()
          .from(SessionMessageTable)
          .where(where)
          .orderBy(order === "asc" ? asc(SessionMessageTable.seq) : desc(SessionMessageTable.seq))
        const rows = yield* (input.limit === undefined ? query.all() : query.limit(input.limit).all()).pipe(
          Effect.orDie,
        )
        return yield* Effect.forEach(direction === "previous" ? rows.toReversed() : rows, decode)
      }),
      message: Effect.fn("V2Session.message")(function* (input) {
        const stored = yield* store.message(input.messageID)
        return stored?.sessionID === input.sessionID ? stored.message : undefined
      }),
      context: Effect.fn("V2Session.context")(function* (sessionID) {
        yield* result.get(sessionID)
        return yield* store.context(sessionID)
      }),
      events: (input) =>
        Stream.unwrap(
          result
            .get(input.sessionID)
            .pipe(Effect.as(events.aggregateEvents({ aggregateID: input.sessionID, after: input.after }))),
        ).pipe(
          Stream.filter((event): event is EventV2.CursorEvent<SessionEvent.DurableEvent> =>
            isDurableSessionEvent(event.event),
          ),
        ),
      prompt: Effect.fn("V2Session.prompt")((input, guard = Effect.void) =>
        Effect.uninterruptible(
          Effect.gen(function* () {
            yield* result.get(input.sessionID)
            const returnPrompt = Effect.fnUntraced(function* (admitted: SessionInput.Admitted) {
              if (input.resume !== false) yield* enqueueWake(admitted)
              return admitted
            }, Effect.uninterruptible)
            const messageID = input.id ?? SessionMessage.ID.create()
            const delivery = input.delivery ?? "steer"
            const expected = { sessionID: input.sessionID, messageID, prompt: input.prompt, delivery }
            const admitted = yield* guardedCommit(
              (commit) =>
                SessionInput.admit(
                  db,
                  events,
                  {
                    id: messageID,
                    sessionID: input.sessionID,
                    prompt: input.prompt,
                    delivery,
                  },
                  commit,
                ),
              guard,
            ).pipe(
              Effect.catchDefect((defect) =>
                defect instanceof SessionInput.LifecycleConflict
                  ? new PromptConflictError({ sessionID: input.sessionID, messageID })
                  : Effect.die(defect),
              ),
            )
            if (!SessionInput.equivalent(admitted, expected))
              return yield* new PromptConflictError({ sessionID: input.sessionID, messageID })
            return yield* returnPrompt(admitted)
          }),
        ),
      ),
      shell: Effect.fn("V2Session.shell")(function* (input, guard = Effect.void) {
        return yield* Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            yield* result.get(input.sessionID)
            const id = input.id ?? SessionMessage.ID.create()
            const resume = input.resume !== false
            const recorded = yield* SessionInput.findShell(db, id)
            if (
              !recorded &&
              ((yield* SessionInput.find(db, id)) ||
                (yield* SessionInput.findCompaction(db, id)) ||
                (yield* store.message(id)))
            )
              return yield* new ShellConflictError({ sessionID: input.sessionID, messageID: id })
            const admitted = yield* guardedCommit(
              (commit) =>
                SessionInput.admitShell(
                  db,
                  events,
                  {
                    id,
                    sessionID: input.sessionID,
                    command: input.command,
                    resume,
                  },
                  commit,
                ),
              guard,
            ).pipe(
              Effect.catchDefect((defect) =>
                defect instanceof SessionInput.LifecycleConflict
                  ? new ShellConflictError({ sessionID: input.sessionID, messageID: id })
                  : Effect.die(defect),
              ),
            )
            if (
              admitted.sessionID !== input.sessionID ||
              admitted.command !== input.command ||
              admitted.resume !== resume
            )
              return yield* new ShellConflictError({ sessionID: input.sessionID, messageID: id })
            const terminal = yield* SessionInput.terminalShell(db, id)
            if (terminal) {
              if (
                resume &&
                !(yield* SessionInput.shellContinued(db, id)) &&
                !(yield* SessionInput.unknownShellContinuation(db, id))
              )
                yield* enqueueWake(admitted)
              return
            }
            yield* enqueueWake(admitted)
            yield* restore(
              events
                .aggregateEvents({ aggregateID: input.sessionID, after: EventV2.Cursor.make(admitted.admittedSeq) })
                .pipe(
                  Stream.filter((event) => event.event.id === SessionInput.shellTerminalEventID(id)),
                  Stream.take(1),
                  Stream.runDrain,
                ),
            )
          }),
        )
      }),
      skill: Effect.fn("V2Session.skill")(function* (input, guard = Effect.void) {
        const session = yield* result.get(input.sessionID)
        const skill = yield* Effect.gen(function* () {
          yield* (yield* PluginBoot.Service).wait()
          const catalog = yield* (yield* SkillV2.Service).list()
          const selected = catalog.find((item) => item.name === input.skill)
          if (selected) return selected
          return yield* new SkillNotFoundError({
            skill: input.skill,
            available: catalog.map((item) => item.name),
          })
        }).pipe(Effect.provide(locations.get(session.location)))
        return yield* result.prompt(
          {
            id: input.id,
            sessionID: input.sessionID,
            prompt: new Prompt({ text: skill.content }),
            resume: input.resume,
          },
          guard,
        )
      }),
      switchAgent: Effect.fn("V2Session.switchAgent")(function* (input, guard = Effect.void) {
        const session = yield* result.get(input.sessionID)
        const selected = AgentV2.ID.make(input.agent)
        yield* Effect.gen(function* () {
          yield* (yield* PluginBoot.Service).wait()
          const catalog = yield* (yield* AgentV2.Service).all()
          const agent = catalog.find((item) => item.id === selected)
          if (agent && agent.mode !== "subagent" && !agent.hidden) return
          return yield* new AgentUnavailableError({
            agent: selected,
            available: catalog.filter((item) => item.mode !== "subagent" && !item.hidden).map((item) => item.id),
          })
        }).pipe(Effect.provide(locations.get(session.location)))
        if (session.agent === selected) return yield* guardedCheck(db, guard)
        const timestamp = yield* DateTime.now
        yield* guardedCommit(
          (commit) =>
            events.publish(
              SessionEvent.AgentSwitched,
              {
                sessionID: input.sessionID,
                messageID: SessionMessage.ID.create(),
                timestamp,
                agent: selected,
              },
              { commit: () => commit },
            ),
          guard,
        )
      }),
      switchModel: Effect.fn("V2Session.switchModel")(function* (input, guard = Effect.void) {
        const session = yield* result.get(input.sessionID)
        const resolved = yield* Effect.gen(function* () {
          return yield* (yield* SessionRunnerModel.Service).resolve({ ...session, model: input.model })
        }).pipe(Effect.provide(locations.get(session.location)))
        const custom = (yield* SessionHistory.load(db, input.sessionID)).some(
          (message) =>
            message.type === "assistant" &&
            message.content.some((part) => part.type === "tool" && part.toolType === "custom"),
        )
        if (custom && !resolved.model.route.capabilities.includes("custom-tools"))
          return yield* new ModelHistoryIncompatibleError({
            sessionID: input.sessionID,
            model: input.model,
            protocol: resolved.model.route.protocol,
            feature: "custom-tools",
          })
        const timestamp = yield* DateTime.now
        yield* guardedCommit(
          (commit) =>
            events.publish(
              SessionEvent.ModelSwitched,
              {
                sessionID: input.sessionID,
                messageID: SessionMessage.ID.create(),
                timestamp,
                model: input.model,
              },
              { commit: () => commit },
            ),
          guard,
        )
      }),
      compact: Effect.fn("V2Session.compact")(function* (input, guard = Effect.void) {
        return yield* Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            yield* result.get(input.sessionID)
            if ((input.prompt?.files?.length ?? 0) > 0 || (input.prompt?.agents?.length ?? 0) > 0)
              return yield* new CompactionPromptUnsupportedError({
                message: "Manual compaction instructions support text only",
              })
            const id = input.id ?? SessionMessage.ID.create()
            const recorded = yield* SessionInput.findCompaction(db, id)
            if (!recorded && ((yield* SessionInput.find(db, id)) || (yield* store.message(id))))
              return yield* new CompactionConflictError({ sessionID: input.sessionID, messageID: id })
            const admitted = yield* guardedCommit(
              (commit) =>
                SessionInput.admitCompaction(
                  db,
                  events,
                  {
                    id,
                    sessionID: input.sessionID,
                    instruction: input.prompt?.text,
                  },
                  commit,
                ),
              guard,
            ).pipe(
              Effect.catchDefect((defect) =>
                defect instanceof SessionInput.LifecycleConflict
                  ? new CompactionConflictError({ sessionID: input.sessionID, messageID: id })
                  : Effect.die(defect),
              ),
            )
            if (admitted.sessionID !== input.sessionID || admitted.instruction !== input.prompt?.text)
              return yield* new CompactionConflictError({ sessionID: input.sessionID, messageID: id })
            const finish = Effect.fnUntraced(function* () {
              const terminal = yield* SessionInput.terminalCompaction(db, id)
              if (!terminal) return false
              if (terminal.type === "failed")
                return yield* new CompactionFailedError({
                  sessionID: input.sessionID,
                  messageID: id,
                  reason: terminal.reason,
                  message: terminal.message,
                })
              return true
            })
            if (yield* finish()) return
            const wake = yield* execution.wake(input.sessionID, admitted.admittedSeq).pipe(Effect.exit)
            if (wake._tag === "Failure") {
              yield* SessionInput.failCompaction(db, events, admitted, {
                reason: "execution",
                message: "Compaction execution could not be scheduled",
              })
            }
            if (wake._tag === "Success")
              yield* restore(
                events
                  .aggregateEvents({ aggregateID: input.sessionID, after: EventV2.Cursor.make(admitted.admittedSeq) })
                  .pipe(
                    Stream.filter((event) => event.event.id === SessionInput.compactionTerminalEventID(id)),
                    Stream.take(1),
                    Stream.runDrain,
                  ),
              )
            if (
              (yield* Effect.all([
                SessionInput.hasPending(db, input.sessionID, "steer"),
                SessionInput.hasPending(db, input.sessionID, "queue"),
              ])).some(Boolean)
            )
              yield* execution.wake(input.sessionID).pipe(Effect.exit)
            yield* finish()
          }).pipe(Effect.asVoid),
        )
      }),
      wait: Effect.fn("V2Session.wait")(function* (sessionID) {
        yield* result.get(sessionID)
        yield* execution.wait(sessionID)
      }),
      resume: Effect.fn("V2Session.resume")(function* (sessionID) {
        yield* result.get(sessionID)
        yield* execution.resume(sessionID)
      }),
      interrupt: Effect.fn("V2Session.interrupt")((sessionID, guard) =>
        Effect.uninterruptible(
          Effect.gen(function* () {
            const session = yield* store.get(sessionID)
            if (!session) {
              if (guard) {
                yield* guard
                return
              }
              return yield* execution.interrupt(sessionID)
            }
            const commit = guard ?? Effect.void
            const timestamp = yield* DateTime.now
            const event = yield* guardedCommit(
              (commit) =>
                events.publish(SessionEvent.InterruptRequested, { sessionID, timestamp }, { commit: () => commit }),
              commit,
            )
            if (event.seq === undefined)
              return yield* Effect.die("Interrupt request event is missing aggregate sequence")
            for (const message of yield* store.context(sessionID).pipe(Effect.orDie)) {
              if (message.type !== "assistant") continue
              for (const tool of message.content) {
                if (
                  tool.type !== "tool" ||
                  tool.name !== "task" ||
                  (tool.state.status !== "pending" && tool.state.status !== "running")
                )
                  continue
                const task = yield* SessionTask.request(db, sessionID, message.id, tool.id)
                if (task) {
                  const data = {
                    sessionID,
                    timestamp: yield* DateTime.now,
                    assistantMessageID: message.id,
                    callID: tool.id,
                    childSessionID: task.childSessionID,
                  }
                  if (!(yield* SessionTask.interrupted(db, sessionID, message.id, tool.id)))
                    yield* events.publish(SessionEvent.Task.Interrupted, data, {
                      id: SessionTask.interruptedEventID(sessionID, message.id, tool.id),
                    })
                  yield* events.publish(SessionEvent.Task.Interrupt, data)
                }
                if (!task && !(yield* SessionTask.prepared(db, sessionID, message.id, tool.id))) continue
                yield* events.publish(
                  SessionEvent.Tool.Failed,
                  {
                    sessionID,
                    timestamp: yield* DateTime.now,
                    assistantMessageID: message.id,
                    callID: tool.id,
                    error: { type: "unknown", message: "Tool execution interrupted" },
                    provider: {
                      executed: tool.provider?.executed === true,
                      ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
                    },
                  },
                  { id: SessionTask.interruptedToolEventID(sessionID, message.id, tool.id) },
                )
              }
            }
            yield* execution.interrupt(sessionID, event.seq)
            yield* Effect.forEach(
              yield* SessionInput.pendingRequestedShells(db, sessionID),
              (request) =>
                SessionInput.endShell(
                  db,
                  events,
                  request,
                  {
                    status: "interrupted",
                    output: "Shell command was interrupted before completion.",
                    truncated: false,
                  },
                  "requested",
                ),
              { discard: true },
            )
          }),
        ),
      ),
    })

    return result
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(LocationServiceMap.layer),
    Layer.provide(SessionExecution.noopLayer),
    Layer.provide(SessionStore.defaultLayer),
    Layer.provide(SessionProjector.defaultLayer),
    Layer.provide(EventV2.defaultLayer),
    Layer.provide(Database.defaultLayer),
    Layer.provide(ProjectV2.defaultLayer),
    Layer.orDie,
  ),
)
