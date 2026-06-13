import type { WslDistroProbe, WslSlopcodeCheck, WslServerItem } from "../../preload/types"

export function wslServerIdToRestart(servers: WslServerItem[], distro: string) {
  return servers.find((item) => item.config.distro === distro)?.config.id
}

export function clearWslDistroState(
  distroProbes: Record<string, WslDistroProbe>,
  slopcodeChecks: Record<string, WslSlopcodeCheck>,
  distro: string,
) {
  const nextDistroProbes = { ...distroProbes }
  const nextSlopcodeChecks = { ...slopcodeChecks }
  delete nextDistroProbes[distro]
  delete nextSlopcodeChecks[distro]
  return { distroProbes: nextDistroProbes, slopcodeChecks: nextSlopcodeChecks }
}

export function wslTerminalArgs(distro?: string | null) {
  return ["/c", "start", "", "wsl", ...(distro ? ["-d", distro] : [])]
}

export function requireWslIpcString(name: string, value: unknown) {
  if (typeof value === "string" && value.length > 0) return value
  throw new Error(`Invalid ${name}`)
}
