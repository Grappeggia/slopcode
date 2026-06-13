import type { WslSlopcodeCheck, WslServerRuntime } from "./types"

export const wslRuntimeRetryable = (runtime: WslServerRuntime) =>
  runtime.kind === "failed" || runtime.kind === "stopped"

export async function enterWslSlopcodeStep(
  distro: string,
  probe: (distro: string) => Promise<unknown>,
  select: (step: "slopcode") => void,
) {
  await probe(distro)
  select("slopcode")
}

export function wslSlopcodeAction(check?: WslSlopcodeCheck) {
  if (!check) return
  if (!check.resolvedPath) return "Install SlopCode"
  if (check.matchesDesktop === false) return "Update SlopCode"
}
