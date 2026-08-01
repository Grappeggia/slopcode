import { existsSync, readdirSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { app } from "electron"
import { hasExistingAppState } from "./install-state"
import { hasLegacyTauriState } from "./legacy-state"
import { write as writeLog } from "./logging"
import { getStore } from "./store"
import { FIRST_LAUNCH_ONBOARDING_COMPLETE_KEY, OLD_LAYOUT_ELIGIBLE_KEY } from "./store-keys"

const defaultProjectDirectory = "Default Project"

export function initializeOldLayoutEligibility(userDataPath: string) {
  const entries = existsSync(userDataPath) ? readdirSync(userDataPath, { withFileTypes: true }) : []
  const store = getStore()
  const current = store.get(OLD_LAYOUT_ELIGIBLE_KEY)
  if (typeof current === "boolean") return current
  const eligible = hasExistingAppState(entries) || hasLegacyTauriState()
  store.set(OLD_LAYOUT_ELIGIBLE_KEY, eligible)
  return eligible
}

export function isOldLayoutEligible() {
  return getStore().get(OLD_LAYOUT_ELIGIBLE_KEY) === true
}

export function isFirstLaunchOnboardingPending() {
  return getStore().get(FIRST_LAUNCH_ONBOARDING_COMPLETE_KEY) !== true
}

export async function finishFirstLaunchOnboarding(createDefaultProject: boolean) {
  if (!isFirstLaunchOnboardingPending()) return null
  const directory = createDefaultProject ? join(app.getPath("documents"), defaultProjectDirectory) : null
  if (directory) await mkdir(directory, { recursive: true })
  getStore().set(FIRST_LAUNCH_ONBOARDING_COMPLETE_KEY, true)
  writeLog("onboarding", "first launch onboarding completed", { createDefaultProject, directory })
  return directory
}
