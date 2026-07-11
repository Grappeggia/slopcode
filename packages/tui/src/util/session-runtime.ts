import type { SessionRuntimeInfo } from "@slopcode-ai/sdk/v2"

export function runtimeOwner(owner: SessionRuntimeInfo["owner"]) {
  return owner === "v1" ? "V1 legacy" : "V2 native"
}

export function runtimeHint(state: SessionRuntimeInfo["state"]) {
  if (state === "paused") return "Restart recovery: sending a prompt resumes durable pending work."
  if (state === "migrating") return "Migration is in progress; wait for V2 ownership before native control."
  if (state === "draining") return "The current runtime is draining; retry native control when it is ready."
}
