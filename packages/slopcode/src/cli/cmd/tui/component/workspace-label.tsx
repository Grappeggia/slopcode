import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"

export function WorkspaceLabel(props: { workspaceID?: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const status = () =>
    props.workspaceID ? (sync.data.workspace_status[props.workspaceID] ?? "connecting") : "connected"
  const color = () => {
    const value = status()
    if (value === "connected") return theme.success
    if (value === "connecting") return theme.warning
    return theme.error
  }

  if (!props.workspaceID) return

  return (
    <text fg={theme.textMuted}>
      <span style={{ fg: color() }}>●</span> workspace {props.workspaceID}
    </text>
  )
}
