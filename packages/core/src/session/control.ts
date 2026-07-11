export * as SessionControl from "./control"

import { Context, Effect, Layer } from "effect"
import { ModelV2 } from "../model"
import { SessionV2 } from "../session"
import { SessionInput } from "./input"
import { SessionMessage } from "./message"
import { Prompt } from "./prompt"
import { SessionRuntime } from "./runtime"
import { SessionRunner } from "./runner"
import { SessionSchema } from "./schema"

type PromptInput = {
  readonly id?: SessionMessage.ID
  readonly sessionID: SessionSchema.ID
  readonly prompt: Prompt
  readonly delivery?: SessionInput.Delivery
  readonly resume?: boolean
}

type SwitchModelInput = {
  readonly sessionID: SessionSchema.ID
  readonly model: ModelV2.Ref
}

type SwitchAgentInput = {
  readonly sessionID: SessionSchema.ID
  readonly agent: string
  readonly epoch?: number
}

type SkillInput = {
  readonly id?: SessionMessage.ID
  readonly sessionID: SessionSchema.ID
  readonly skill: string
  readonly resume?: boolean
  readonly epoch?: number
}

type CompactInput = {
  readonly sessionID: SessionSchema.ID
  readonly prompt?: Prompt
}

export interface Interface {
  readonly prompt: (
    input: PromptInput,
  ) => Effect.Effect<
    SessionInput.Admitted,
    SessionRuntime.Error | SessionV2.NotFoundError | SessionV2.PromptConflictError
  >
  readonly resume: (
    sessionID: SessionSchema.ID,
  ) => Effect.Effect<void, SessionRuntime.Error | SessionV2.NotFoundError | SessionRunner.RunError>
  readonly interrupt: (sessionID: SessionSchema.ID) => Effect.Effect<void, SessionRuntime.Error>
  readonly wait: (
    sessionID: SessionSchema.ID,
  ) => Effect.Effect<void, SessionRuntime.Error | SessionV2.NotFoundError | SessionRunner.RunError>
  readonly compact: (
    input: CompactInput,
  ) => Effect.Effect<void, SessionRuntime.Error | SessionV2.NotFoundError | SessionV2.OperationUnavailableError>
  readonly switchModel: (input: SwitchModelInput) => Effect.Effect<void, SessionRuntime.Error | SessionV2.NotFoundError>
  readonly switchAgent: (
    input: SwitchAgentInput,
  ) => Effect.Effect<void, SessionRuntime.Error | SessionV2.NotFoundError | SessionV2.AgentUnavailableError>
  readonly skill: (
    input: SkillInput,
  ) => Effect.Effect<
    SessionInput.Admitted,
    | SessionRuntime.Error
    | SessionV2.NotFoundError
    | SessionV2.SkillNotFoundError
    | SessionV2.PromptConflictError
  >
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/SessionControl") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const runtime = yield* SessionRuntime.Service
    const assertV2 = (sessionID: SessionSchema.ID, epoch?: number) => runtime.assert({ sessionID, owner: "v2", epoch })

    return Service.of({
      prompt: Effect.fn("SessionControl.prompt")(function* (input) {
        yield* assertV2(input.sessionID)
        return yield* sessions.prompt(input)
      }),
      resume: Effect.fn("SessionControl.resume")(function* (sessionID) {
        yield* assertV2(sessionID)
        yield* sessions.resume(sessionID)
      }),
      interrupt: Effect.fn("SessionControl.interrupt")(function* (sessionID) {
        yield* assertV2(sessionID)
        yield* sessions.interrupt(sessionID)
      }),
      wait: Effect.fn("SessionControl.wait")(function* (sessionID) {
        yield* assertV2(sessionID)
        yield* sessions.wait(sessionID)
      }),
      compact: Effect.fn("SessionControl.compact")(function* (input) {
        yield* assertV2(input.sessionID)
        yield* sessions.compact(input)
      }),
      switchModel: Effect.fn("SessionControl.switchModel")(function* (input) {
        yield* assertV2(input.sessionID)
        yield* sessions.switchModel(input)
      }),
      switchAgent: Effect.fn("SessionControl.switchAgent")(function* (input) {
        const runtime = yield* assertV2(input.sessionID, input.epoch)
        yield* sessions.switchAgent(input, assertV2(input.sessionID, runtime.epoch).pipe(Effect.asVoid))
      }),
      skill: Effect.fn("SessionControl.skill")(function* (input) {
        const runtime = yield* assertV2(input.sessionID, input.epoch)
        return yield* sessions.skill(input, assertV2(input.sessionID, runtime.epoch).pipe(Effect.asVoid))
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(SessionRuntime.defaultLayer),
  Layer.provide(SessionV2.defaultLayer),
)
