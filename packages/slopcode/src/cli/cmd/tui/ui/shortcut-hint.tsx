import { createSignal, onCleanup, type JSX } from "solid-js"
import { useTheme } from "@tui/context/theme"

export function ShortcutHint(props: {
  shortcut: string | JSX.Element
  label?: string | JSX.Element
  onTrigger?: () => void
  disabled?: boolean
}) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const [flash, setFlash] = createSignal(false)
  let timeout: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => {
    if (!timeout) return
    clearTimeout(timeout)
  })

  const trigger = () => {
    if (props.disabled) return
    if (!props.onTrigger) return
    setFlash(true)
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      setFlash(false)
    }, 140)
    props.onTrigger()
  }

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={flash() ? theme.backgroundMenu : hover() ? theme.backgroundElement : undefined}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={trigger}
    >
      <text fg={props.disabled ? theme.textMuted : theme.text}>
        <span style={{ fg: props.disabled ? theme.textMuted : theme.text }}>{props.shortcut}</span>
        <span style={{ fg: theme.textMuted }}>{props.label ? ` ${props.label}` : ""}</span>
      </text>
    </box>
  )
}
