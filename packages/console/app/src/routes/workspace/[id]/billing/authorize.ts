import { Actor } from "@slopcode-ai/console-core/actor.js"

export function asBillingAdmin<T>(fn: (workspaceID: string) => T) {
  Actor.assertAdmin()
  return fn(Actor.workspace())
}
