export * as TaskTool from "./task"

import { ToolFailure } from "@slopcode-ai/llm"
import { and, eq } from "drizzle-orm"
import { DateTime, Effect, Layer, Schema } from "effect"
import { AgentV2 } from "../agent"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import { Location } from "../location"
import { ModelV2 } from "../model"
import { PermissionV2 } from "../permission"
import { ProviderV2 } from "../provider"
import { PluginBoot } from "../plugin/boot"
import { SessionEvent } from "../session/event"
import { SessionInput } from "../session/input"
import { SessionMessage } from "../session/message"
import { Prompt } from "../session/prompt"
import { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"
import { SessionStore } from "../session/store"
import { SessionTask } from "../session/task"
import { SessionTaskMetadata } from "../session/task-metadata"
import { SessionCreate } from "../session/create"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "task"

export const Input = Schema.Struct({
  description: Schema.String.annotate({ description: "A short description of the task" }),
  prompt: Schema.String.annotate({ description: "The task for the subagent to perform" }),
  subagent_type: Schema.String.annotate({ description: "The specialized subagent ID" }),
  task_id: Schema.String.pipe(Schema.optional).annotate({ description: "An existing compatible child task ID" }),
  command: Schema.String.pipe(Schema.optional).annotate({ description: "The command that triggered this task" }),
})

export const Output = Schema.Struct({
  task_id: SessionSchema.ID,
  state: Schema.Literal("completed"),
  result: Schema.String,
})

export const validateInput = (input: unknown) =>
  typeof input === "object" && input !== null && "background" in input
    ? "Invalid task input: background is not supported"
    : undefined

export class AgentUnavailableError extends Schema.TaggedErrorClass<AgentUnavailableError>()(
  "TaskTool.AgentUnavailableError",
  { agent: AgentV2.ID, available: Schema.Array(AgentV2.ID) },
) {}

export class ResumeConflictError extends Schema.TaggedErrorClass<ResumeConflictError>()(
  "TaskTool.ResumeConflictError",
  {
    taskID: Schema.String,
    message: Schema.String,
  },
) {}

export class ChildFailedError extends Schema.TaggedErrorClass<ChildFailedError>()("TaskTool.ChildFailedError", {
  taskID: SessionSchema.ID,
  message: Schema.String,
}) {}

const callable = (agent: AgentV2.Info) => !agent.hidden && (agent.mode === "subagent" || agent.mode === "all")

export function describe(agents: ReadonlyArray<AgentV2.Info>, permissions: PermissionV2.Ruleset = []) {
  const available = agents
    .filter(callable)
    .filter((agent) => PermissionV2.evaluate(name, agent.id, permissions).effect !== "deny")
    .toSorted((left, right) => left.id.localeCompare(right.id))
  return [
    "Launch a foreground subagent and wait for its durable V2 Session result.",
    "Use task_id only to continue a child returned by an earlier task call.",
    "",
    "Callable subagents:",
    ...(available.length === 0
      ? ["(none)"]
      : available.map((agent) => `${agent.id}: ${agent.description ?? "No description"}`)),
  ].join("\n")
}

const sameLocation = (row: typeof SessionTable.$inferSelect, location: Location.Ref) =>
  row.directory === location.directory && (row.workspace_id ?? undefined) === location.workspaceID

const sameModel = (left: ModelV2.Ref, right: typeof SessionTable.$inferSelect.model) =>
  right !== null &&
  right !== undefined &&
  left.id === right.id &&
  left.providerID === right.providerID &&
  left.variant === ModelV2.VariantID.make(right.variant ?? "default")

const render = (output: { readonly task_id: string; readonly state: "completed"; readonly result: string }) =>
  [`<task id="${output.task_id}" state="completed">`, "<task_result>", output.result, "</task_result>", "</task>"].join(
    "\n",
  )

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const agents = yield* AgentV2.Service
    const boot = yield* PluginBoot.Service
    const permission = yield* PermissionV2.Service
    const location = yield* Location.Service
    const events = yield* EventV2.Service
    const store = yield* SessionStore.Service
    const db = (yield* Database.Service).db

    yield* boot.wait()
    const catalog = yield* agents.all()

    const failure = (error: unknown) =>
      new ToolFailure({
        message:
          error instanceof AgentUnavailableError
            ? `Agent ${error.agent} is unavailable. Callable agents: ${error.available.join(", ") || "none"}`
            : error instanceof ResumeConflictError || error instanceof ChildFailedError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Task execution failed",
        error,
      })

    const validate = Effect.fn("TaskTool.validateChild")(function* (input: {
      id: string
      parent: SessionSchema.Info
      agent: AgentV2.ID
      model?: ModelV2.Ref
      title?: string
      origin?: SessionTaskMetadata.Owner["origin"]
      ceiling?: PermissionV2.Ruleset
      canonical?: boolean
      request?: SessionEvent.Task.Requested["data"]
    }) {
      if (!input.id.startsWith("ses_"))
        return yield* new ResumeConflictError({
          taskID: input.id,
          message: `Task resume conflict: invalid task_id ${input.id}`,
        })
      const id = SessionSchema.ID.make(input.id)
      const row = yield* db.select().from(SessionTable).where(eq(SessionTable.id, id)).get().pipe(Effect.orDie)
      const owner = SessionTaskMetadata.owner(row?.metadata)
      const origin = owner
        ? yield* SessionTask.request(db, owner.parentID, owner.origin.messageID, owner.origin.callID)
        : undefined
      const canonical =
        input.canonical !== true ||
        (owner !== undefined &&
          origin !== undefined &&
          row !== undefined &&
          row.id === SessionTask.childID(owner.parentID, owner.origin.messageID, owner.origin.callID) &&
          origin.sessionID === owner.parentID &&
          origin.assistantMessageID === owner.origin.messageID &&
          origin.callID === owner.origin.callID &&
          origin.childSessionID === row.id &&
          origin.promptMessageID === SessionTask.promptID(owner.parentID, owner.origin.messageID, owner.origin.callID) &&
          origin.agent === owner.agent &&
          origin.agent === row.agent &&
          origin.projectID === row.project_id &&
          origin.location.directory === row.directory &&
          origin.location.workspaceID === (row.workspace_id ?? undefined) &&
          origin.title === row.title &&
          sameModel(origin.model, row.model) &&
          JSON.stringify(origin.ceiling) === JSON.stringify(owner.ceiling))
      const request =
        input.request === undefined ||
        (row !== undefined &&
          input.request.sessionID === input.parent.id &&
          input.request.childSessionID === row.id &&
          input.request.promptMessageID ===
            SessionTask.promptID(input.parent.id, input.request.assistantMessageID, input.request.callID) &&
          input.request.agent === row.agent &&
          input.request.projectID === row.project_id &&
          input.request.location.directory === row.directory &&
          input.request.location.workspaceID === (row.workspace_id ?? undefined) &&
          input.request.title === row.title &&
          sameModel(input.request.model, row.model) &&
          JSON.stringify(input.request.ceiling) === JSON.stringify(owner?.ceiling))
      if (
        !row ||
        row.runtime !== "v2" ||
        row.parent_id !== input.parent.id ||
        row.project_id !== input.parent.projectID ||
        row.agent !== input.agent ||
        (input.title !== undefined && row.title !== input.title) ||
        (input.model !== undefined && !sameModel(input.model, row.model)) ||
        !sameLocation(row, location) ||
        !owner ||
        owner.parentID !== input.parent.id ||
        owner.agent !== input.agent ||
        (input.origin !== undefined &&
          (owner.origin.messageID !== input.origin.messageID || owner.origin.callID !== input.origin.callID)) ||
        (input.ceiling !== undefined && JSON.stringify(owner.ceiling) !== JSON.stringify(input.ceiling)) ||
        !canonical ||
        !request
      )
        return yield* new ResumeConflictError({
          taskID: input.id,
          message: `Task resume conflict: ${input.id} is not a compatible child of this Session`,
        })
      return row
    })

    const terminal = Effect.fn("TaskTool.terminal")(function* (taskID: SessionSchema.ID, promptID: SessionMessage.ID) {
      const context = yield* store.context(taskID)
      const prompt = context.findIndex((message) => message.id === promptID && message.type === "user")
      if (prompt < 0) return
      const assistants = context
        .slice(prompt + 1)
        .filter((message): message is SessionMessage.Assistant => message.type === "assistant")
      const last = assistants.at(-1)
      if (!last?.time.completed || last.finish === "tool-calls") return
      if (last.error)
        return yield* new ChildFailedError({ taskID, message: last.error.message || `Task ${taskID} failed` })
      return (
        assistants
          .flatMap((message) => message.content)
          .filter((part): part is SessionMessage.AssistantText => part.type === "text" && part.text.length > 0)
          .at(-1)?.text ?? ""
      )
    })

    const interrupt = Effect.fn("TaskTool.interruptChild")(function* (input: {
      parentID: SessionSchema.ID
      messageID: SessionMessage.ID
      callID: string
      childID: SessionSchema.ID
    }) {
      if (yield* SessionTask.interrupted(db, input.parentID, input.messageID, input.callID)) return
      yield* events.publish(
        SessionEvent.Task.Interrupted,
        {
          sessionID: input.parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: input.messageID,
          callID: input.callID,
          childSessionID: input.childID,
        },
        { id: SessionTask.interruptedEventID(input.parentID, input.messageID, input.callID) },
      )
      yield* events.publish(SessionEvent.Task.Interrupt, {
        sessionID: input.parentID,
        timestamp: yield* DateTime.now,
        assistantMessageID: input.messageID,
        callID: input.callID,
        childSessionID: input.childID,
      })
    })

    const run = Effect.fn("TaskTool.runChild")(function* (input: {
      taskID: SessionSchema.ID
      promptID: SessionMessage.ID
      prompt: string
      context: Tool.Context
    }) {
      const result = yield* terminal(input.taskID, input.promptID)
      if (result !== undefined) return result
      const admitted = yield* SessionInput.admit(db, events, {
        id: input.promptID,
        sessionID: input.taskID,
        prompt: new Prompt({ text: input.prompt }),
        delivery: "steer",
      })
      if (
        !SessionInput.equivalent(admitted, {
          sessionID: input.taskID,
          prompt: new Prompt({ text: input.prompt }),
          delivery: "steer",
        })
      )
        return yield* new ResumeConflictError({
          taskID: input.taskID,
          message: `Task ${input.taskID} prompt identity conflicts`,
        })
      yield* events.publish(SessionEvent.Task.Execute, {
        sessionID: input.context.sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: input.context.assistantMessageID,
        callID: input.context.toolCallID,
        childSessionID: input.taskID,
      })
      const completed = yield* terminal(input.taskID, input.promptID)
      if (completed === undefined)
        return yield* new ChildFailedError({
          taskID: input.taskID,
          message: `Task ${input.taskID} ended without terminal output`,
        })
      return completed
    })

    yield* tools
      .register({
        [name]: Tool.make({
          description: (permissions) => describe(catalog, permissions),
          input: Input,
          output: Output,
          validateInput,
          toModelOutput: ({ output }) => [{ type: "text", text: render(output) }],
          execute: (input, context) =>
            Effect.gen(function* () {
              if (context.task) {
                const request = context.task
                if (
                  request.sessionID !== context.sessionID ||
                  request.assistantMessageID !== context.assistantMessageID ||
                  request.callID !== context.toolCallID ||
                  request.description !== input.description ||
                  request.prompt !== input.prompt ||
                  request.agent !== input.subagent_type ||
                  request.command !== input.command
                )
                  return yield* new ResumeConflictError({
                    taskID: request.childSessionID,
                    message: `Task ${request.childSessionID} recovery identity conflicts`,
                  })
                const parent = yield* store.get(request.sessionID)
                if (!parent)
                  return yield* new ResumeConflictError({
                    taskID: request.childSessionID,
                    message: `Parent Session not found: ${request.sessionID}`,
                  })
                yield* validate({
                  id: request.childSessionID,
                  parent,
                  agent: AgentV2.ID.make(request.agent),
                  canonical: true,
                  request,
                })
                const result = yield* run({
                  taskID: request.childSessionID,
                  promptID: request.promptMessageID,
                  prompt: request.prompt,
                  context,
                }).pipe(
                  Effect.onInterrupt(() =>
                    interrupt({
                      parentID: context.sessionID,
                      messageID: context.assistantMessageID,
                      callID: context.toolCallID,
                      childID: request.childSessionID,
                    }),
                  ),
                )
                return { task_id: request.childSessionID, state: "completed" as const, result }
              }
              const current = (yield* agents.all())
                .filter(callable)
                .filter((agent) => PermissionV2.evaluate(name, agent.id, context.permissions).effect !== "deny")
                .toSorted((left, right) => left.id.localeCompare(right.id))
              const selectedID = AgentV2.ID.make(input.subagent_type)
              const selected = current.find((agent) => agent.id === selectedID)
              if (!selected)
                return yield* new AgentUnavailableError({
                  agent: selectedID,
                  available: current.map((agent) => agent.id),
                })

              yield* permission.assert({
                action: name,
                resources: [selected.id],
                save: [selected.id],
                sessionID: context.sessionID,
                agent: context.agent,
                metadata: { description: input.description, agent: selected.id },
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              const parent = yield* store.get(context.sessionID)
              if (!parent)
                return yield* new ResumeConflictError({
                  taskID: input.task_id ?? "new",
                  message: `Parent Session not found: ${context.sessionID}`,
                })
              const source = yield* store.message(context.assistantMessageID)
              if (source?.sessionID !== context.sessionID || source.message.type !== "assistant")
                return yield* new ResumeConflictError({
                  taskID: input.task_id ?? "new",
                  message: "Task source is not an assistant message in the parent Session",
                })
              const inherited = source.message.model
              const expected = selected.model ?? inherited
              const ceiling = [
                ...context.permissions.filter((rule) => rule.effect === "deny"),
                ...(selected.permissions.some((rule) => rule.action === name)
                  ? []
                  : [{ action: name, resource: "*", effect: "deny" as const }]),
                ...(selected.permissions.some((rule) => rule.action === "todowrite")
                  ? []
                  : [{ action: "todowrite", resource: "*", effect: "deny" as const }]),
              ]
              const deterministic = SessionTask.childID(
                context.sessionID,
                context.assistantMessageID,
                context.toolCallID,
              )
              const title = `${input.description} (@${selected.id} subagent)`
              const origin = { messageID: context.assistantMessageID, callID: context.toolCallID }
              const owner = { version: 1 as const, parentID: context.sessionID, agent: selected.id, origin, ceiling }
              if (!input.task_id) {
                const existing = yield* db
                  .select({ id: SessionTable.id })
                  .from(SessionTable)
                  .where(eq(SessionTable.id, deterministic))
                  .get()
                  .pipe(Effect.orDie)
                if (!existing)
                  yield* SessionCreate.create(events, store, {
                    id: deterministic,
                    parentID: parent.id,
                    projectID: parent.projectID,
                    location,
                    subpath: parent.subpath,
                    title,
                    agent: selected.id,
                    model: expected,
                    metadata: { task: owner },
                    runtime: "v2",
                  })
              }
              const row = yield* validate(
                input.task_id
                  ? { id: input.task_id, parent, agent: selected.id, canonical: true }
                  : { id: deterministic, parent, agent: selected.id, model: expected, title, origin, ceiling },
              )
              if (!row.model)
                return yield* new ResumeConflictError({
                  taskID: row.id,
                  message: `Task ${row.id} has no persisted model`,
                })
              const model = ModelV2.Ref.make({
                id: ModelV2.ID.make(row.model.id),
                providerID: ProviderV2.ID.make(row.model.providerID),
                variant: ModelV2.VariantID.make(row.model.variant ?? "default"),
              })
              if (!input.task_id && !sameModel(expected, row.model))
                return yield* new ResumeConflictError({
                  taskID: row.id,
                  message: `Task ${row.id} model identity conflicts`,
                })
              const taskID = SessionSchema.ID.make(row.id)
              const promptID = SessionTask.promptID(context.sessionID, context.assistantMessageID, context.toolCallID)
              const recorded = yield* SessionTask.request(
                db,
                context.sessionID,
                context.assistantMessageID,
                context.toolCallID,
              )
              const request = {
                sessionID: context.sessionID,
                timestamp: yield* DateTime.now,
                assistantMessageID: context.assistantMessageID,
                callID: context.toolCallID,
                childSessionID: taskID,
                promptMessageID: promptID,
                description: input.description,
                prompt: input.prompt,
                agent: selected.id,
                model,
                command: input.command,
                multiAgent: context.multiAgent ?? "v2",
                callerAgent: context.agent,
                permissions: context.permissions,
                plan: { ...context.plan, multiAgent: context.multiAgent ?? "v2" },
                projectID: parent.projectID,
                location,
                title,
                ceiling,
              } as const
              if (
                recorded &&
                (recorded.sessionID !== request.sessionID ||
                  recorded.assistantMessageID !== request.assistantMessageID ||
                  recorded.callID !== request.callID ||
                  recorded.childSessionID !== request.childSessionID ||
                  recorded.promptMessageID !== request.promptMessageID ||
                  recorded.description !== request.description ||
                  recorded.prompt !== request.prompt ||
                  recorded.agent !== request.agent ||
                  recorded.command !== request.command ||
                  recorded.multiAgent !== request.multiAgent ||
                  recorded.callerAgent !== request.callerAgent ||
                  JSON.stringify(recorded.permissions) !== JSON.stringify(request.permissions) ||
                  JSON.stringify(recorded.plan) !== JSON.stringify(request.plan) ||
                  recorded.projectID !== request.projectID ||
                  recorded.location.directory !== request.location.directory ||
                  recorded.location.workspaceID !== request.location.workspaceID ||
                  recorded.title !== request.title ||
                  JSON.stringify(recorded.ceiling) !== JSON.stringify(request.ceiling) ||
                  recorded.model.id !== request.model.id ||
                  recorded.model.providerID !== request.model.providerID ||
                  recorded.model.variant !== request.model.variant)
              )
                return yield* new ResumeConflictError({
                  taskID,
                  message: `Task ${taskID} invocation identity conflicts`,
                })
              if (!recorded)
                yield* events.publish(SessionEvent.Task.Requested, request, {
                  id: SessionTask.requestEventID(context.sessionID, context.assistantMessageID, context.toolCallID),
                })
              yield* events.publish(SessionEvent.Tool.Progress, {
                sessionID: context.sessionID,
                timestamp: yield* DateTime.now,
                assistantMessageID: context.assistantMessageID,
                callID: context.toolCallID,
                structured: { state: "running", taskID, childSessionID: taskID, agent: selected.id, model },
                content: [],
              })

              const result = yield* run({ taskID, promptID, prompt: input.prompt, context }).pipe(
                Effect.onInterrupt(() =>
                  interrupt({
                    parentID: context.sessionID,
                    messageID: context.assistantMessageID,
                    callID: context.toolCallID,
                    childID: taskID,
                  }),
                ),
              )
              return { task_id: taskID, state: "completed" as const, result }
            }).pipe(Effect.mapError(failure)),
        }),
      })
      .pipe(Effect.orDie)
  }),
)
