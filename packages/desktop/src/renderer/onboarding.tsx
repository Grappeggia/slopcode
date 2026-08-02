import { ServerConnection, useServer, useTabs } from "@slopcode-ai/app"
import { createEffect, onCleanup } from "solid-js"
import { shouldCreateDefaultProject } from "./onboarding-policy"

export function DesktopFirstLaunchOnboarding() {
  const server = useServer()
  const tabs = useTabs()
  let active = true
  let started = false

  createEffect(() => {
    if (!server.ready() || !tabs.ready() || started) return
    started = true
    void (async () => {
      if (!active) return

      const existingInstall = await window.api.isOldLayoutEligible()
      if (!active) return
      const pending = await window.api.isFirstLaunchOnboardingPending()
      if (!active) return
      const shouldCreateDefaultProject = shouldCreateDefaultProjectFor(server, tabs.store.length, pending, existingInstall)

      const directory = await window.api.finishFirstLaunchOnboarding(shouldCreateDefaultProject)
      if (!active) return
      if (!directory || !shouldCreateDefaultProject) return

      server.projects.open(directory)
      server.projects.touch(directory)
      tabs.newDraft({ server: server.key, directory })
    })().catch((error) => {
      console.error("[desktop-onboarding] first launch onboarding failed", error)
    })
  })

  onCleanup(() => {
    active = false
  })

  return null
}

function shouldCreateDefaultProjectFor(
  server: ReturnType<typeof useServer>,
  tabCount: number,
  pending: boolean,
  existingInstall: boolean,
) {
  return shouldCreateDefaultProject({
    pending,
    existingInstall,
    local: server.isLocal(),
    tabCount,
    serverCount: server.list.length,
    builtInServerCount: server.list.filter(ServerConnection.builtin).length,
  })
}
