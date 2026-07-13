export * as SessionRunner from "./index"

import type { LLMError } from "@slopcode-ai/llm"
import { Context, Effect, Schema } from "effect"
import { SessionSchema } from "../schema"
import type { ContextSnapshotDecodeError, MessageDecodeError } from "../error"
import { SessionRunnerModel } from "./model"
import type { SystemContext } from "../../system-context/index"
import type { SessionContextEpoch } from "../context-epoch"
import type { ToolOutputStore } from "../../tool-output-store"
import type { SessionRuntime } from "../runtime"

export class StepLimitExceededError extends Schema.TaggedErrorClass<StepLimitExceededError>()(
  "SessionRunner.StepLimitExceededError",
  {
    sessionID: SessionSchema.ID,
    limit: Schema.Int,
  },
) {}

export class ProviderStreamError extends Schema.TaggedErrorClass<ProviderStreamError>()(
  "SessionRunner.ProviderStreamError",
  {
    message: Schema.String,
    exhausted: Schema.Boolean,
  },
) {}

export class RestartRequestMismatch extends Schema.TaggedErrorClass<RestartRequestMismatch>()(
  "SessionRunner.RestartRequestMismatch",
  { message: Schema.String },
) {}

export type RunError =
  | LLMError
  | SessionRunnerModel.Error
  | MessageDecodeError
  | ContextSnapshotDecodeError
  | StepLimitExceededError
  | ProviderStreamError
  | RestartRequestMismatch
  | SystemContext.InitializationBlocked
  | SessionContextEpoch.AgentReplacementBlocked
  | ToolOutputStore.Error
  | SessionRuntime.Error

/** Runs one local continuation from already-recorded Session history. */
export interface Interface {
  /** Drains eligible durable work. Explicit runs perform one provider attempt even when no work is eligible. */
  readonly run: (input: {
    readonly sessionID: SessionSchema.ID
    readonly force?: boolean
    readonly recovery?: {
      readonly requestAttempt: number
      readonly providerAttempt: number
      readonly fingerprint: string
    }
  }) => Effect.Effect<void, RunError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/SessionRunner") {}
