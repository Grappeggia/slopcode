import { Context } from "effect"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionControl } from "@slopcode-ai/core/session/control"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"

export interface Interface {
  readonly session: Context.Service.Shape<typeof SessionV2.Service>
  readonly control: Context.Service.Shape<typeof SessionControl.Service>
  readonly runtime: Context.Service.Shape<typeof SessionRuntime.Service>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/server/SessionGraph") {}

export * as SessionGraph from "./session-graph"
