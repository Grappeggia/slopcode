import { WorktreeAdaptor } from "./worktree"
import type { Adaptor, AdaptorInfo } from "./types"

const builtin: Record<string, Adaptor> = {
  worktree: WorktreeAdaptor,
}

const state = new Map<string, Map<string, Adaptor>>()

export function getAdaptor(projectID: string, type: string): Adaptor {
  const custom = state.get(projectID)?.get(type)
  if (custom) return custom
  const adaptor = builtin[type]
  if (adaptor) return adaptor
  throw new Error(`Unknown workspace adaptor: ${type}`)
}

export function listAdaptors(projectID: string): AdaptorInfo[] {
  const custom = [...(state.get(projectID)?.entries() ?? [])].map(([type, adaptor]) => ({
    type,
    name: adaptor.name,
    description: adaptor.description,
  }))
  return [
    ...Object.entries(builtin).map(([type, adaptor]) => ({
      type,
      name: adaptor.name,
      description: adaptor.description,
    })),
    ...custom,
  ]
}

export function registerAdaptor(projectID: string, type: string, adaptor: Adaptor) {
  const adaptors = state.get(projectID) ?? new Map<string, Adaptor>()
  adaptors.set(type, adaptor)
  state.set(projectID, adaptors)
}
