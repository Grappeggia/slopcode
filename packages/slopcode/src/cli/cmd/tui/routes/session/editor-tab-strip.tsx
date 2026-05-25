import { createSignal, For, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { Locale } from "@/util/locale"
import type { EditorTab } from "@tui/context/tab-state-store"

function Tab(props: {
  label: string
  active: boolean
  dirty?: boolean
  closable?: boolean
  onSelect(): void
  onClose?(): void
}) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const bg = () => {
    if (props.active) return theme.backgroundElement
    if (hover()) return theme.backgroundPanel
    return theme.background
  }
  const fg = () => (props.active || hover() ? theme.text : theme.textMuted)

  return (
    <box
      flexDirection="row"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={bg()}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={props.onSelect}
      gap={1}
    >
      <text fg={fg()} wrapMode="none">
        {props.label}
        <Show when={props.dirty}>
          <span style={{ fg: theme.warning }}> *</span>
        </Show>
      </text>
      <Show when={props.closable}>
        <box
          paddingLeft={1}
          paddingRight={1}
          justifyContent="center"
          backgroundColor={hover() ? theme.background : theme.backgroundPanel}
          onMouseUp={(evt) => {
            evt.preventDefault()
            evt.stopPropagation()
            props.onClose?.()
          }}
        >
          <text fg={hover() ? theme.text : theme.textMuted} wrapMode="none">
            [x]
          </text>
        </box>
      </Show>
    </box>
  )
}

export function EditorTabStrip(props: {
  tabs: EditorTab[]
  active?: string
  onSelect(file: string | undefined): void
  onClose(file: string): void
}) {
  const { theme } = useTheme()

  return (
    <box flexShrink={0} flexDirection="row" gap={1} backgroundColor={theme.background}>
      <Tab label="Chat" active={!props.active} onSelect={() => props.onSelect(undefined)} />
      <For each={props.tabs}>
        {(tab) => (
          <Tab
            label={Locale.truncateMiddle(tab.file, 24)}
            active={props.active === tab.file}
            dirty={tab.dirty}
            closable={true}
            onSelect={() => props.onSelect(tab.file)}
            onClose={() => props.onClose(tab.file)}
          />
        )}
      </For>
    </box>
  )
}
