import {
  RequestError,
  type Agent as ACPAgent,
  type AgentSideConnection,
  type AuthenticateRequest,
  type CancelNotification,
  type CloseSessionRequest,
  type ForkSessionRequest,
  type InitializeRequest,
  type ListSessionsRequest,
  type LoadSessionRequest,
  type NewSessionRequest,
  type PromptRequest,
  type ResumeSessionRequest,
  type SetSessionConfigOptionRequest,
  type SetSessionModelRequest,
  type SetSessionModeRequest,
} from "@agentclientprotocol/sdk"
import { Effect } from "effect"
import type { SlopcodeClient } from "@slopcode-ai/sdk/v2"
import * as ACPError from "./error"
import * as ACPService from "./service"

export function init({ sdk: _sdk }: { sdk: SlopcodeClient }) {
  const agents = new Set<Agent>()
  return {
    create: (connection: AgentSideConnection) => {
      const subscription = { stop: () => Promise.resolve() }
      const agent = new Agent(
        ACPService.make({
          sdk: _sdk,
          connection,
          eventSubscription: (value) => (subscription.stop = () => value.stop()),
        }),
        () => subscription.stop(),
      )
      agents.add(agent)
      return agent
    },
    close: async () => {
      const active = [...agents]
      agents.clear()
      await Promise.all(active.map((agent) => agent.close()))
    },
  }
}

export class Agent implements ACPAgent {
  private readonly pending = new Set<Promise<unknown>>()
  private closing: Promise<void> | undefined

  constructor(
    private readonly service: ACPService.Interface,
    private readonly dispose: () => Promise<void> = () => Promise.resolve(),
  ) {}

  initialize(params: InitializeRequest) {
    return this.run(this.service.initialize(params))
  }

  authenticate(params: AuthenticateRequest) {
    return this.run(this.service.authenticate(params))
  }

  newSession(params: NewSessionRequest) {
    return this.run(this.service.newSession(params))
  }

  loadSession(params: LoadSessionRequest) {
    return this.run(this.service.loadSession(params))
  }

  listSessions(params: ListSessionsRequest) {
    return this.run(this.service.listSessions(params))
  }

  resumeSession(params: ResumeSessionRequest) {
    return this.run(this.service.resumeSession(params))
  }

  closeSession(params: CloseSessionRequest) {
    return this.run(this.service.closeSession(params))
  }

  unstable_forkSession(params: ForkSessionRequest) {
    return this.run(this.service.forkSession(params))
  }

  setSessionConfigOption(params: SetSessionConfigOptionRequest) {
    return this.run(this.service.setSessionConfigOption(params))
  }

  setSessionMode(params: SetSessionModeRequest) {
    return this.run(this.service.setSessionMode(params))
  }

  unstable_setSessionModel(params: SetSessionModelRequest) {
    return this.run(this.service.setSessionModel(params))
  }

  prompt(params: PromptRequest) {
    return this.run(this.service.prompt(params))
  }

  cancel(params: CancelNotification) {
    return this.run(this.service.cancel(params))
  }

  close() {
    if (this.closing) return this.closing
    this.closing = Promise.allSettled([this.dispose(), ...this.pending]).then(() => undefined)
    return this.closing
  }

  private run<A>(effect: Effect.Effect<A, ACPService.Error>) {
    const pending = execute(effect)
    this.pending.add(pending)
    void pending.then(
      () => this.pending.delete(pending),
      () => this.pending.delete(pending),
    )
    return pending
  }
}

function execute<A>(effect: Effect.Effect<A, ACPService.Error>) {
  return Effect.runPromise(effect.pipe(Effect.mapError(ACPError.toRequestError))).catch((defect: unknown) => {
    if (defect instanceof RequestError) throw defect
    throw ACPError.toRequestError(ACPError.fromUnknownDefect(defect))
  })
}

export * as ACP from "./agent"
