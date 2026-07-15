import path from "path"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Question } from "../question"
import { Session } from "@/session/session"
import { Provider } from "@/provider/provider"
import { InstanceState } from "@/effect/instance-state"
import { MessageID, PartID } from "../session/schema"
import { Agent } from "../agent/agent"
import { Permission } from "../permission"
import EXIT_DESCRIPTION from "./plan-exit.txt"

export const Parameters = Schema.Struct({})

export const PlanPermissionsParameters = Schema.Struct({
  permissions: Schema.Array(Permission.ForecastCandidate).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(Permission.ForecastLimits.candidates),
  ),
})

export const PlanPermissionsTool = Tool.define(
  "plan_permissions",
  Effect.gen(function* () {
    const agents = yield* Agent.Service
    const permission = yield* Permission.Service
    const session = yield* Session.Service

    return {
      description:
        "Replace the likely build-mode permission forecast with exact actions and resources for review before leaving plan mode.",
      parameters: PlanPermissionsParameters,
      execute: (params: typeof PlanPermissionsParameters.Type, ctx: Tool.Context) =>
        Effect.gen(function* () {
          if (ctx.agent !== "plan") return yield* Effect.die("plan_permissions is available only to the plan agent")
          const build = yield* agents.get("build")
          if (!build) return yield* Effect.die("Build agent not found")
          const info = yield* session.get(ctx.sessionID)
          const candidates = yield* permission.forecast({
            sessionID: ctx.sessionID,
            ruleset: Permission.merge(build.permission, info.permission ?? []),
            candidates: params.permissions,
          })
          return {
            title: candidates.length
              ? `Forecast ${candidates.length} build permission${candidates.length === 1 ? "" : "s"}`
              : "No build permissions need review",
            output: candidates.length
              ? "The previous forecast was replaced. These exact permissions will be reviewed before build starts."
              : "The previous forecast was cleared because every candidate is already allowed or denied by configuration.",
            metadata: { permissions: candidates },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const PlanExitTool = Tool.define(
  "plan_exit",
  Effect.gen(function* () {
    const session = yield* Session.Service
    const question = yield* Question.Service
    const provider = yield* Provider.Service
    const permission = yield* Permission.Service

    return {
      description: EXIT_DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const info = yield* session.get(ctx.sessionID)
          const plan = path.relative(instance.worktree, Session.plan(info, instance))
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                question: `Plan at ${plan} is complete. Would you like to switch to the build agent and start implementing?`,
                header: "Build Agent",
                custom: false,
                options: [
                  { label: "Yes", description: "Switch to build agent and start implementing the plan" },
                  { label: "No", description: "Stay with plan agent to continue refining the plan" },
                ],
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          if (answers[0]?.[0] === "No") yield* new Question.RejectedError()

          yield* permission.review({
            sessionID: ctx.sessionID,
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          const messages = yield* session.messages({ sessionID: ctx.sessionID }).pipe(Effect.orDie)
          const lastUser = messages.findLast((item) => item.info.role === "user" && item.info.model)
          const model =
            lastUser?.info.role === "user" && lastUser.info.model ? lastUser.info.model : yield* provider.defaultModel()

          const msg: SessionV1.User = {
            id: MessageID.ascending(),
            sessionID: ctx.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: "build",
            model,
          }
          yield* session.updateMessage(msg)
          yield* session.updatePart({
            id: PartID.ascending(),
            messageID: msg.id,
            sessionID: ctx.sessionID,
            type: "text",
            text: `The plan at ${plan} has been approved, you can now edit files. Execute the plan`,
            synthetic: true,
          } satisfies SessionV1.TextPart)

          return {
            title: "Switching to build agent",
            output: "User approved switching to build agent. Wait for further instructions.",
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)
