export * as SessionControl from "./control"

import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionControl as CoreSessionControl } from "@slopcode-ai/core/session/control"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { AgentAttachment, FileAttachment, Prompt, Source } from "@slopcode-ai/core/session/prompt"
import { SessionFormat } from "@slopcode-ai/core/session/format"
import { SessionRunner } from "@slopcode-ai/core/session/runner"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import * as SessionExecutionLocal from "@slopcode-ai/core/session/execution/local"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { EventV2 } from "@slopcode-ai/core/event"
import { Database } from "@slopcode-ai/core/database/database"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Context, Effect, Layer } from "effect"
import { Image } from "@/image/image"
import { SessionPrompt } from "./prompt"
import { SessionID } from "./schema"
import { projectV2 } from "./message-compat"

export interface Interface {
  readonly cancel: (sessionID: SessionID) => Effect.Effect<void, SessionRuntime.Error>
  readonly messages: (sessionID: SessionID) => Effect.Effect<SessionV1.WithParts[] | undefined, SessionV2.Error>
  readonly prompt: (
    input: SessionPrompt.PromptInput,
  ) => Effect.Effect<
    SessionV1.WithParts | SessionInput.Admitted,
    Image.Error | SessionPrompt.AdmissionFailed | SessionRuntime.Error | SessionV2.Error | SessionRunner.RunError
  >
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/SessionControl") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const runtime = yield* SessionRuntime.Service
    const legacy = yield* SessionPrompt.Service
    const control = yield* CoreSessionControl.Service

    const prompt = Effect.fn("SessionControl.prompt")(function* (input: SessionPrompt.PromptInput) {
      const info = yield* runtime.get(input.sessionID)
      if (info?.owner === "v2") {
        const admitted = yield* control.prompt({
          sessionID: input.sessionID,
          id: input.messageID ? SessionMessage.ID.make(input.messageID) : undefined,
          prompt: toPrompt(input.parts, input.format),
          resume: input.noReply === true ? false : undefined,
        })
        if (input.noReply === true) return admitted
        yield* control.wait(input.sessionID)
        const result = yield* control.messages(input.sessionID)
        const projected = projectV2(input.sessionID, result.messages, result.info)
        const message = projected.find(
          (message) => message.info.role === "assistant" && String(message.info.parentID) === String(admitted.id),
        )
        if (!message) return yield* Effect.die("V2 prompt completed without a projected message")
        return message
      }
      const current = yield* runtime.assert({
        sessionID: input.sessionID,
        owner: "v1",
        state: "ready",
        epoch: info?.epoch,
      })
      return yield* legacy.prompt(
        input,
        runtime
          .assert({ sessionID: input.sessionID, owner: "v1", state: "ready", epoch: current.epoch })
          .pipe(Effect.asVoid),
      )
    })

    const messages = Effect.fn("SessionControl.messages")(function* (sessionID: SessionID) {
      if ((yield* runtime.get(sessionID))?.owner !== "v2") return undefined
      const result = yield* control.messages(sessionID)
      return projectV2(sessionID, result.messages, result.info)
    })

    const cancel = Effect.fn("SessionControl.cancel")(function* (sessionID: SessionID) {
      const info = yield* runtime.get(sessionID)
      if (info?.owner === "v2") return yield* control.interrupt(sessionID)
      const current = yield* runtime.assert({ sessionID, owner: "v1", state: "ready", epoch: info?.epoch })
      yield* legacy.cancel(sessionID, (cancel) =>
        runtime.claim({ sessionID, owner: "v1", state: "ready", epoch: current.epoch }, cancel).pipe(Effect.asVoid),
      )
    })

    return Service.of({ cancel, messages, prompt })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(
    Layer.mergeAll(SessionRuntime.defaultLayer, CoreSessionControl.defaultLayer, SessionPrompt.defaultLayer),
  ),
)

const sessions = LayerNode.make(
  Layer.fresh(SessionV2.layer).pipe(
    Layer.provide(SessionExecutionLocal.defaultLayer),
    Layer.provide(SessionStore.defaultLayer),
    Layer.provide(SessionProjector.defaultLayer),
    Layer.provide(EventV2.defaultLayer),
    Layer.provide(Database.defaultLayer),
    Layer.provide(ProjectV2.defaultLayer),
    Layer.provide(LocationServiceMap.layer),
    Layer.orDie,
  ),
  [],
)
const control = LayerNode.make(CoreSessionControl.layer, [SessionRuntime.node, sessions])

export const node = LayerNode.make(layer, [SessionRuntime.node, control, SessionPrompt.node])

function toPrompt(parts: SessionPrompt.PromptInput["parts"], format: SessionPrompt.PromptInput["format"]) {
  const files = parts.flatMap((part) => {
    if (part.type !== "file") return []
    return [
      new FileAttachment({
        uri: part.url,
        mime: part.mime,
        name: part.filename,
        description: part.source?.type === "symbol" ? part.source.name : undefined,
        source: part.source
          ? new Source({
              start: part.source.text.start,
              end: part.source.text.end,
              text: part.source.text.value,
            })
          : undefined,
      }),
    ]
  })
  const agents = parts.flatMap((part) => {
    if (part.type !== "agent") return []
    return [
      new AgentAttachment({
        name: part.name,
        source: part.source
          ? new Source({ start: part.source.start, end: part.source.end, text: part.source.value })
          : undefined,
      }),
    ]
  })
  return new Prompt({
    text: parts
      .flatMap((part) => {
        if (part.type === "text" && part.ignored !== true) return [part.text]
        if (part.type === "subtask") return [part.prompt]
        return []
      })
      .join("\n"),
    ...(files.length ? { files } : {}),
    ...(agents.length ? { agents } : {}),
    format:
      format?.type === "json_schema"
        ? ({ type: "json_schema", schema: format.schema, retry_count: format.retryCount ?? 2 } as SessionFormat.Format)
        : format,
  })
}
