import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { Button } from "@slopcode-ai/ui/button"
import { Icon } from "@slopcode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { permissionScope, type PermissionDecision } from "./session-permission"
import { SessionPermissionDockView } from "./session-permission-view"

export { SessionPermissionDockView } from "./session-permission-view"

export function SessionPermissionDock(props: {
  request: PermissionRequest
  responding: boolean
  onDecide: (response: PermissionDecision) => void
}) {
  const language = useLanguage()
  const sync = useSync()
  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.permission}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  return (
    <SessionPermissionDockView
      {...props}
      scope={permissionScope(sync.project)}
      toolDescription={toolDescription()}
      t={(key) => language.t(key as Parameters<typeof language.t>[0])}
      button={Button}
      icon={<Icon name="warning" size="normal" />}
    />
  )
}
