export * as Tools from "./tools"

import { Context, Effect, Scope } from "effect"
import { Tool } from "./tool"

export interface Interface {
  readonly register: (
    tools: Readonly<Record<string, Tool.AnyTool>>,
    options?: RegistrationOptions,
  ) => Effect.Effect<void, Tool.RegistrationError, Scope.Scope>
}

export interface RegistrationOptions {
  /** Stable source placement reused only while replacing one active producer. */
  readonly slot?: object
  /** Keeps a staged generation out of materialization until its owner publishes it. */
  readonly visible?: () => boolean
}

/** Narrow registration-only Location capability. */
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/Tools") {}
