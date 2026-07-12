import { Schema } from "effect"
import { ProviderMetadata, ToolContent } from "@slopcode-ai/llm"
import { EventV2 } from "../event"
import { ModelV2 } from "../model"
import { NonNegativeInt } from "../schema"
import { V2Schema } from "../v2-schema"
import { FileAttachment, Prompt } from "./prompt"
import { SessionSchema } from "./schema"
import { Location } from "../location"
import { RelativePath } from "../schema"
import { SessionMessageID } from "./message-id"
import { ProjectV2 } from "../project"
import { AgentV2 } from "../agent"
import { PermissionSchema } from "../permission/schema"

export { FileAttachment }

export const Source = Schema.Struct({
  start: NonNegativeInt,
  end: NonNegativeInt,
  text: Schema.String,
}).annotate({
  identifier: "session.next.event.source",
})
export type Source = typeof Source.Type

const Base = {
  timestamp: V2Schema.DateTimeUtcFromMillis,
  sessionID: SessionSchema.ID,
}

const options = {
  sync: {
    aggregate: "sessionID",
    version: 1,
  },
} as const
const stepSettlementOptions = {
  sync: {
    aggregate: "sessionID",
    version: 2,
  },
} as const

export const UnknownError = Schema.Struct({
  type: Schema.Literal("unknown"),
  message: Schema.String,
}).annotate({
  identifier: "Session.Error.Unknown",
})
export type UnknownError = typeof UnknownError.Type

export const Created = EventV2.define({
  type: "session.next.created",
  ...options,
  schema: {
    ...Base,
    parentID: SessionSchema.ID.pipe(Schema.optional),
    projectID: ProjectV2.ID,
    location: Location.RefJson,
    subpath: RelativePath.pipe(Schema.optional),
    title: Schema.String,
    slug: Schema.String,
    version: Schema.String,
    agent: AgentV2.ID.pipe(Schema.optional),
    model: ModelV2.Ref.pipe(Schema.optional),
    metadata: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional),
    runtime: Schema.Literals(["v1", "v2"]),
  },
})
export type Created = typeof Created.Type

export const AgentSwitched = EventV2.define({
  type: "session.next.agent.switched",
  ...options,
  schema: {
    ...Base,
    messageID: SessionMessageID.ID,
    agent: Schema.String,
  },
})
export type AgentSwitched = typeof AgentSwitched.Type

export const ModelSwitched = EventV2.define({
  type: "session.next.model.switched",
  ...options,
  schema: {
    ...Base,
    messageID: SessionMessageID.ID,
    model: ModelV2.Ref,
  },
})
export type ModelSwitched = typeof ModelSwitched.Type

export const Moved = EventV2.define({
  type: "session.next.moved",
  ...options,
  schema: {
    ...Base,
    location: Location.RefJson,
    subdirectory: RelativePath.pipe(Schema.optional),
  },
})
export type Moved = typeof Moved.Type

export const Prompted = EventV2.define({
  type: "session.next.prompted",
  ...options,
  schema: {
    ...Base,
    messageID: SessionMessageID.ID,
    prompt: Prompt,
    delivery: Schema.Literals(["steer", "queue"]),
  },
})
export type Prompted = typeof Prompted.Type

export namespace PromptLifecycle {
  export const Admitted = EventV2.define({
    type: "session.next.prompt.admitted",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      prompt: Prompt,
      delivery: Schema.Literals(["steer", "queue"]),
    },
  })
  export type Admitted = typeof Admitted.Type

  export const Promoted = EventV2.define({
    type: "session.next.prompt.promoted",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      prompt: Prompt,
      timeCreated: V2Schema.DateTimeUtcFromMillis,
    },
  })
  export type Promoted = typeof Promoted.Type
}

export const InterruptRequested = EventV2.define({
  type: "session.next.interrupt.requested",
  ...options,
  schema: Base,
})
export type InterruptRequested = typeof InterruptRequested.Type

export const ContextUpdated = EventV2.define({
  type: "session.next.context.updated",
  ...options,
  schema: {
    ...Base,
    messageID: SessionMessageID.ID,
    text: Schema.String,
  },
})
export type ContextUpdated = typeof ContextUpdated.Type

export const Synthetic = EventV2.define({
  type: "session.next.synthetic",
  ...options,
  schema: {
    ...Base,
    messageID: SessionMessageID.ID,
    text: Schema.String,
  },
})
export type Synthetic = typeof Synthetic.Type

export namespace Shell {
  export const Requested = EventV2.define({
    type: "session.next.shell.requested",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      command: Schema.String,
      resume: Schema.Boolean,
    },
  })
  export type Requested = typeof Requested.Type

  export const Started = EventV2.define({
    type: "session.next.shell.started",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      callID: Schema.String,
      command: Schema.String,
    },
  })
  export type Started = typeof Started.Type

  // Retain the v1 decoder so existing shell history remains replayable.
  export const EndedV1 = EventV2.define({
    type: "session.next.shell.ended",
    ...options,
    schema: {
      ...Base,
      callID: Schema.String,
      output: Schema.String,
    },
  })

  export const Status = Schema.Literals(["completed", "timed_out", "failed", "interrupted", "unknown"])
  export type Status = typeof Status.Type

  export const Ended = EventV2.define({
    type: "session.next.shell.ended",
    sync: { aggregate: "sessionID", version: 2 },
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      callID: Schema.String,
      output: Schema.String,
      status: Status,
      exitCode: Schema.Number.pipe(Schema.optional),
      truncated: Schema.Boolean,
      stdoutTruncated: Schema.Boolean.pipe(Schema.optional),
      stderrTruncated: Schema.Boolean.pipe(Schema.optional),
    },
  })
  export type Ended = typeof Ended.Type

  export const Continued = EventV2.define({
    type: "session.next.shell.continued",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
    },
  })
  export type Continued = typeof Continued.Type

  export const ContinuationStarted = EventV2.define({
    type: "session.next.shell.continuation.started",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
    },
  })
  export type ContinuationStarted = typeof ContinuationStarted.Type

  export const ContinuationUnknown = EventV2.define({
    type: "session.next.shell.continuation.unknown",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
    },
  })
  export type ContinuationUnknown = typeof ContinuationUnknown.Type
}

export namespace Step {
  export const Started = EventV2.define({
    type: "session.next.step.started",
    ...options,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      rootUserID: SessionMessageID.ID.pipe(Schema.optional),
      agent: Schema.String,
      model: ModelV2.Ref,
      snapshot: Schema.String.pipe(Schema.optional),
    },
  })
  export type Started = typeof Started.Type

  export const Ended = EventV2.define({
    type: "session.next.step.ended",
    ...stepSettlementOptions,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      finish: Schema.String,
      cost: Schema.Finite,
      tokens: Schema.Struct({
        input: Schema.Finite,
        output: Schema.Finite,
        reasoning: Schema.Finite,
        cache: Schema.Struct({
          read: Schema.Finite,
          write: Schema.Finite,
        }),
      }),
      snapshot: Schema.String.pipe(Schema.optional),
    },
  })
  export type Ended = typeof Ended.Type

  export const Failed = EventV2.define({
    type: "session.next.step.failed",
    ...stepSettlementOptions,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      error: UnknownError,
    },
  })
  export type Failed = typeof Failed.Type
}

export namespace Structured {
  export const FailureReason = Schema.Literals([
    "invalid-json",
    "schema",
    "value-limit",
    "stale",
    "missing-final",
    "interrupted",
  ])

  export const Dispatched = EventV2.define({
    type: "session.next.structured.dispatched",
    ...options,
    schema: {
      ...Base,
      rootUserID: SessionMessageID.ID,
      attempt: NonNegativeInt,
      fingerprint: Schema.String,
    },
  })

  export const Candidate = EventV2.define({
    type: "session.next.structured.candidate",
    ...options,
    schema: {
      ...Base,
      rootUserID: SessionMessageID.ID,
      assistantMessageID: SessionMessageID.ID,
      attempt: NonNegativeInt,
      fingerprint: Schema.String,
      value: Schema.Unknown.pipe(Schema.optional),
      invalid: Schema.Boolean,
      invalidReason: Schema.Literals(["invalid-json", "value-limit"]).pipe(Schema.optional),
    },
  })

  export const Retry = EventV2.define({
    type: "session.next.structured.retry",
    ...options,
    schema: {
      ...Base,
      rootUserID: SessionMessageID.ID,
      assistantMessageID: SessionMessageID.ID,
      attempt: NonNegativeInt,
      remaining: NonNegativeInt,
      reason: FailureReason,
      message: Schema.String,
    },
  })

  export const Result = EventV2.define({
    type: "session.next.structured.result",
    ...options,
    schema: {
      ...Base,
      rootUserID: SessionMessageID.ID,
      assistantMessageID: SessionMessageID.ID,
      value: Schema.Unknown,
      attempts: NonNegativeInt,
      retryCount: NonNegativeInt,
    },
  })

  export const Failed = EventV2.define({
    type: "session.next.structured.failed",
    ...options,
    schema: {
      ...Base,
      rootUserID: SessionMessageID.ID,
      assistantMessageID: SessionMessageID.ID,
      reason: FailureReason,
      attempts: NonNegativeInt,
      retryCount: NonNegativeInt,
      exhausted: Schema.Boolean,
      message: Schema.String,
    },
  })
}

export namespace Execution {
  export const Message = Schema.String.check(Schema.makeFilter((value) =>
    new TextEncoder().encode(value).byteLength <= 512 ? undefined : "Expected at most 512 UTF-8 bytes"
  ))
  const Fingerprint = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))
  export const Activity = Schema.Literals(["prompt", "shell", "compaction", "task"])
  export const Phase = Schema.Literals(["preparing", "provider", "tool", "shell", "compaction", "task", "settling"])
  export const TerminalCode = Schema.Literals([
    "interrupted",
    "restart",
    "runtime-replaced",
    "provider-nonretryable",
    "provider-exhausted",
    "runner-failure",
    "step-limit",
  ])
  export const RetryCode = Schema.Literals(["rate-limit", "server", "explicit", "dispatch-uncertain"])
  export type RetryCode = typeof RetryCode.Type
  export const RetryAction = Schema.Literal("retry-provider")
  export type RetryAction = typeof RetryAction.Type
  const Identity = {
    ...Base,
    owner: Schema.Literal("v2"),
    epoch: NonNegativeInt,
    activityID: SessionMessageID.ID,
    rootID: SessionMessageID.ID,
    activity: Activity,
  }
  const Active = {
    ...Identity,
    phase: Phase,
    requestAttempt: NonNegativeInt.pipe(Schema.optional),
    providerAttempt: NonNegativeInt.pipe(Schema.optional),
    structuredAttempt: NonNegativeInt.pipe(Schema.optional),
    fingerprint: Fingerprint.pipe(Schema.optional),
  }

  export const Started = EventV2.define({
    type: "session.next.execution.started",
    ...options,
    schema: Active,
  })
  export type Started = typeof Started.Type

  export const ProviderDispatched = EventV2.define({
    type: "session.next.execution.provider.dispatched",
    ...options,
    schema: {
      ...Active,
      requestAttempt: NonNegativeInt,
      providerAttempt: NonNegativeInt,
      fingerprint: Fingerprint,
      recovery: Schema.Literals(["retry-provider", "continue-provider", "interrupt"]),
    },
  })
  export type ProviderDispatched = typeof ProviderDispatched.Type

  export const ProviderCompleted = EventV2.define({
    type: "session.next.execution.provider.completed",
    ...options,
    schema: { ...Active, requestAttempt: NonNegativeInt, providerAttempt: NonNegativeInt, fingerprint: Fingerprint },
  })
  export type ProviderCompleted = typeof ProviderCompleted.Type

  export const ContinuationReady = EventV2.define({
    type: "session.next.execution.continuation.ready",
    ...options,
    schema: {
      ...Active,
      requestAttempt: NonNegativeInt,
      providerAttempt: NonNegativeInt,
      fingerprint: Fingerprint,
      recovery: Schema.Literal("continue-provider"),
    },
  })
  export type ContinuationReady = typeof ContinuationReady.Type

  export const RetryScheduled = EventV2.define({
    type: "session.next.execution.retry.scheduled",
    ...options,
    schema: {
      ...Active,
      requestAttempt: NonNegativeInt,
      attempt: NonNegativeInt,
      maxAttempts: NonNegativeInt,
      nextAt: NonNegativeInt,
      code: RetryCode,
      action: RetryAction,
      message: Message,
      fingerprint: Fingerprint,
      recovery: Schema.Literals(["retry-provider", "interrupt"]),
    },
  })
  export type RetryScheduled = typeof RetryScheduled.Type

  export const Succeeded = EventV2.define({
    type: "session.next.execution.succeeded",
    ...options,
    schema: Identity,
  })
  export type Succeeded = typeof Succeeded.Type

  const Terminal = {
    ...Active,
    code: TerminalCode,
    message: Message,
    resultingEpoch: NonNegativeInt,
  }
  export const Interrupted = EventV2.define({
    type: "session.next.execution.interrupted",
    ...options,
    schema: Terminal,
  })
  export type Interrupted = typeof Interrupted.Type
  export const Failed = EventV2.define({
    type: "session.next.execution.failed",
    ...options,
    schema: Terminal,
  })
  export type Failed = typeof Failed.Type
}

export namespace Text {
  export const Started = EventV2.define({
    type: "session.next.text.started",
    ...options,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      textID: Schema.String,
    },
  })
  export type Started = typeof Started.Type

  // Stream fragments are live-only; Text.Ended is the replayable full-value boundary.
  export const Delta = EventV2.define({
    type: "session.next.text.delta",
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      textID: Schema.String,
      delta: Schema.String,
    },
  })
  export type Delta = typeof Delta.Type

  export const Ended = EventV2.define({
    type: "session.next.text.ended",
    ...options,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      textID: Schema.String,
      text: Schema.String,
    },
  })
  export type Ended = typeof Ended.Type
}

export namespace Reasoning {
  export const Started = EventV2.define({
    type: "session.next.reasoning.started",
    ...options,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      reasoningID: Schema.String,
      providerMetadata: ProviderMetadata.pipe(Schema.optional),
    },
  })
  export type Started = typeof Started.Type

  // Stream fragments are live-only; Reasoning.Ended is the replayable full-value boundary.
  export const Delta = EventV2.define({
    type: "session.next.reasoning.delta",
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      reasoningID: Schema.String,
      delta: Schema.String,
    },
  })
  export type Delta = typeof Delta.Type

  export const Ended = EventV2.define({
    type: "session.next.reasoning.ended",
    ...options,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      reasoningID: Schema.String,
      text: Schema.String,
      providerMetadata: ProviderMetadata.pipe(Schema.optional),
    },
  })
  export type Ended = typeof Ended.Type
}

export namespace Tool {
  const ToolBase = {
    ...Base,
    assistantMessageID: SessionMessageID.ID,
    callID: Schema.String,
  }

  export namespace Input {
    export const Started = EventV2.define({
      type: "session.next.tool.input.started",
      ...options,
      schema: {
        ...ToolBase,
        name: Schema.String,
      },
    })
    export type Started = typeof Started.Type

    // Stream fragments are live-only; Input.Ended is the replayable raw-input boundary.
    export const Delta = EventV2.define({
      type: "session.next.tool.input.delta",
      schema: {
        ...ToolBase,
        delta: Schema.String,
      },
    })
    export type Delta = typeof Delta.Type

    export const Ended = EventV2.define({
      type: "session.next.tool.input.ended",
      ...options,
      schema: {
        ...ToolBase,
        text: Schema.String,
      },
    })
    export type Ended = typeof Ended.Type
  }

  export const Called = EventV2.define({
    type: "session.next.tool.called",
    ...options,
    schema: {
      ...ToolBase,
      tool: Schema.String,
      input: Schema.Record(Schema.String, Schema.Unknown),
      provider: Schema.Struct({
        executed: Schema.Boolean,
        metadata: ProviderMetadata.pipe(Schema.optional),
      }),
    },
  })
  export const CalledV1 = Called

  export const CalledV2 = EventV2.define({
    type: "session.next.tool.called",
    sync: { aggregate: "sessionID", version: 2 },
    schema: {
      ...ToolBase,
      tool: Schema.String,
      input: Schema.String,
      toolType: Schema.Literal("custom"),
      provider: Schema.Struct({
        executed: Schema.Boolean,
        metadata: ProviderMetadata.pipe(Schema.optional),
      }),
    },
  })
  export type Called = typeof Called.Type | typeof CalledV2.Type

  /**
   * Replayable bounded running-tool state. Tools should checkpoint semantic
   * transitions or at a bounded cadence, not persist every stdout/stderr chunk.
   */
  export const Progress = EventV2.define({
    type: "session.next.tool.progress",
    ...options,
    schema: {
      ...ToolBase,
      structured: Schema.Record(Schema.String, Schema.Any),
      content: Schema.Array(ToolContent),
    },
  })
  export type Progress = typeof Progress.Type

  export const Success = EventV2.define({
    type: "session.next.tool.success",
    ...options,
    schema: {
      ...ToolBase,
      structured: Schema.Record(Schema.String, Schema.Any),
      content: Schema.Array(ToolContent),
      outputPaths: Schema.Array(Schema.String).pipe(Schema.optional),
      result: Schema.Unknown.pipe(Schema.optional),
      provider: Schema.Struct({
        executed: Schema.Boolean,
        metadata: ProviderMetadata.pipe(Schema.optional),
      }),
    },
  })
  export type Success = typeof Success.Type

  export const Failed = EventV2.define({
    type: "session.next.tool.failed",
    ...options,
    schema: {
      ...ToolBase,
      error: UnknownError,
      result: Schema.Unknown.pipe(Schema.optional),
      provider: Schema.Struct({
        executed: Schema.Boolean,
        metadata: ProviderMetadata.pipe(Schema.optional),
      }),
    },
  })
  export type Failed = typeof Failed.Type
}

export namespace Task {
  const TaskBase = {
    ...Base,
    assistantMessageID: SessionMessageID.ID,
    callID: Schema.String,
    childSessionID: SessionSchema.ID,
  }

  export const Prepared = EventV2.define({
    type: "session.next.task.prepared",
    ...options,
    schema: {
      ...Base,
      assistantMessageID: SessionMessageID.ID,
      callID: Schema.String,
      input: Schema.Unknown,
      callerAgent: AgentV2.ID,
      permissions: PermissionSchema.Ruleset,
      plan: Schema.Struct({
        mode: Schema.Literals(["function", "code-preferred", "code-only"]).pipe(Schema.optional),
        shell: Schema.Literal("shell_command").pipe(Schema.optional),
        patch: Schema.Literal("freeform").pipe(Schema.optional),
        multiAgent: Schema.Literals(["v1", "v2"]),
      }),
      agent: AgentV2.ID,
      available: Schema.Array(AgentV2.ID),
      model: ModelV2.Ref,
      projectID: ProjectV2.ID,
      location: Location.RefJson,
      title: Schema.String,
      ceiling: PermissionSchema.Ruleset,
    },
  })
  export type Prepared = typeof Prepared.Type

  export const Requested = EventV2.define({
    type: "session.next.task.requested",
    ...options,
    schema: {
      ...TaskBase,
      promptMessageID: SessionMessageID.ID,
      description: Schema.String,
      prompt: Schema.String,
      agent: Schema.String,
      model: ModelV2.Ref,
      command: Schema.String.pipe(Schema.optional),
      multiAgent: Schema.Literals(["v1", "v2"]),
      callerAgent: AgentV2.ID,
      permissions: PermissionSchema.Ruleset,
      plan: Schema.Struct({
        mode: Schema.Literals(["function", "code-preferred", "code-only"]).pipe(Schema.optional),
        shell: Schema.Literal("shell_command").pipe(Schema.optional),
        patch: Schema.Literal("freeform").pipe(Schema.optional),
        multiAgent: Schema.Literals(["v1", "v2"]),
      }),
      projectID: ProjectV2.ID,
      location: Location.RefJson,
      title: Schema.String,
      ceiling: PermissionSchema.Ruleset,
    },
  })
  export type Requested = typeof Requested.Type

  export const Interrupted = EventV2.define({
    type: "session.next.task.interrupted",
    ...options,
    schema: TaskBase,
  })
  export type Interrupted = typeof Interrupted.Type

  /** Process-local execution signal backed by the authoritative Session lane. */
  export const Execute = EventV2.define({
    type: "session.next.task.execute",
    schema: TaskBase,
  })

  /** Process-local cascade signal emitted only after interruption is durable. */
  export const Interrupt = EventV2.define({
    type: "session.next.task.interrupt",
    schema: TaskBase,
  })
}

export const RetryError = Schema.Struct({
  message: Schema.String,
  statusCode: Schema.Finite.pipe(Schema.optional),
  isRetryable: Schema.Boolean,
  responseHeaders: Schema.Record(Schema.String, Schema.String).pipe(Schema.optional),
  responseBody: Schema.String.pipe(Schema.optional),
  metadata: Schema.Record(Schema.String, Schema.String).pipe(Schema.optional),
}).annotate({
  identifier: "session.next.retry_error",
})
export type RetryError = typeof RetryError.Type

export const Retried = EventV2.define({
  type: "session.next.retried",
  ...options,
  schema: {
    ...Base,
    attempt: Schema.Finite,
    error: RetryError,
  },
})
export type Retried = typeof Retried.Type

export namespace Compaction {
  export const Requested = EventV2.define({
    type: "session.next.compaction.requested",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      instruction: Schema.String.pipe(Schema.optional),
    },
  })
  export type Requested = typeof Requested.Type

  export const Skipped = EventV2.define({
    type: "session.next.compaction.skipped",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
    },
  })
  export type Skipped = typeof Skipped.Type

  export const Failed = EventV2.define({
    type: "session.next.compaction.failed",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      reason: Schema.Literals(["provider", "empty", "context", "interrupted", "runtime", "execution"]),
      message: Schema.String,
    },
  })
  export type Failed = typeof Failed.Type

  export const Started = EventV2.define({
    type: "session.next.compaction.started",
    ...options,
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      reason: Schema.Union([Schema.Literal("auto"), Schema.Literal("manual")]),
    },
  })
  export type Started = typeof Started.Type

  export const Delta = EventV2.define({
    type: "session.next.compaction.delta",
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      text: Schema.String,
    },
  })
  export type Delta = typeof Delta.Type

  // Retain the unpublished v1 decoder so stored beta events remain replayable.
  export const EndedV1 = EventV2.define({
    type: "session.next.compaction.ended",
    ...options,
    schema: {
      ...Base,
      text: Schema.String,
      include: Schema.String.pipe(Schema.optional),
    },
  })

  export const Ended = EventV2.define({
    type: "session.next.compaction.ended",
    sync: { aggregate: "sessionID", version: 2 },
    schema: {
      ...Base,
      messageID: SessionMessageID.ID,
      reason: Started.data.fields.reason,
      text: Schema.String,
      recent: Schema.String,
    },
  })
  export type Ended = typeof Ended.Type
}

const ShellEndedV1 = Shell.EndedV1.pipe(Schema.check(Schema.makeFilter((event) => event.version === 1)))
const ShellEnded = Shell.Ended.pipe(Schema.check(Schema.makeFilter((event) => event.version === 2)))
const ToolCalledV1 = Tool.Called.pipe(Schema.check(Schema.makeFilter((event) => event.version === 1)))
const ToolCalled = Tool.CalledV2.pipe(Schema.check(Schema.makeFilter((event) => event.version === 2)))

const DurableDefinitions = [
  AgentSwitched,
  ModelSwitched,
  Moved,
  Prompted,
  PromptLifecycle.Admitted,
  PromptLifecycle.Promoted,
  InterruptRequested,
  ContextUpdated,
  Synthetic,
  Shell.Requested,
  Shell.Started,
  ShellEndedV1,
  ShellEnded,
  Shell.Continued,
  Shell.ContinuationStarted,
  Shell.ContinuationUnknown,
  Step.Started,
  Step.Ended,
  Step.Failed,
  Text.Started,
  Text.Ended,
  Tool.Input.Started,
  Tool.Input.Ended,
  ToolCalledV1,
  ToolCalled,
  Tool.Progress,
  Tool.Success,
  Tool.Failed,
  Task.Prepared,
  Task.Requested,
  Task.Interrupted,
  Reasoning.Started,
  Reasoning.Ended,
  Retried,
  Compaction.Requested,
  Compaction.Skipped,
  Compaction.Failed,
  Compaction.Started,
  Compaction.Ended,
] as const
const EphemeralDefinitions = [Text.Delta, Tool.Input.Delta, Reasoning.Delta, Compaction.Delta] as const

const StructuredDefinitions = [Structured.Dispatched, Structured.Retry, Structured.Result, Structured.Failed] as const
const ExecutionDefinitions = [
  Execution.Started,
  Execution.ProviderDispatched,
  Execution.ProviderCompleted,
  Execution.RetryScheduled,
  Execution.Succeeded,
  Execution.Interrupted,
  Execution.Failed,
] as const
const DurableBase = Schema.Union(DurableDefinitions, { mode: "oneOf" })
const StructuredDurable = Schema.Union(StructuredDefinitions, { mode: "oneOf" })
const ExecutionDurable = Schema.Union(ExecutionDefinitions, { mode: "oneOf" })
export const Durable = Schema.Union([DurableBase, StructuredDurable, ExecutionDurable], { mode: "oneOf" }).pipe(
  Schema.toTaggedUnion("type"),
)
export type DurableEvent = typeof Durable.Type

const AllBase = Schema.Union([Created, ...DurableDefinitions, ...EphemeralDefinitions], { mode: "oneOf" })
export const All = Schema.Union([AllBase, StructuredDurable, ExecutionDurable], { mode: "oneOf" }).pipe(Schema.toTaggedUnion("type"))
export type Event = typeof All.Type
export type Type = Event["type"]

export * as SessionEvent from "./event"
