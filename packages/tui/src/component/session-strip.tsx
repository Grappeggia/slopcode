import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useSessionTabs } from "../context/session-tabs"
import { useTheme } from "../context/theme"
import { layoutSessionStrip, sessionStripTabLabel, SessionStripText } from "./session-strip-layout"

export function SessionStrip() {
  const tabs = useSessionTabs()
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const [hover, setHover] = createSignal<string>()
  const layout = createMemo(() => layoutSessionStrip(tabs.tabs(), { active: tabs.active(), width: dimensions().width }))
  const background = (id: string) => (hover() === id ? theme.backgroundElement : theme.backgroundPanel)
  const foreground = (id: string) =>
    tabs.active() === id ? theme.accent : hover() === id ? theme.text : theme.textMuted

  return (
    <Show when={tabs.visible()}>
      <box height={1} flexShrink={0} flexDirection="row" backgroundColor={theme.backgroundPanel}>
        <Show
          when={layout().prev}
          fallback={<text fg={theme.border}>{layout().tabs.length ? SessionStripText.SEP : ""}</text>}
        >
          {(id) => (
            <>
              <box onMouseUp={() => tabs.open(id())}>
                <text fg={theme.textMuted}>{"<"}</text>
              </box>
              <text fg={theme.border}>{SessionStripText.SEP}</text>
            </>
          )}
        </Show>
        <For each={layout().tabs}>
          {(tab) => (
            <>
              <box
                flexDirection="row"
                backgroundColor={background(tab.id)}
                onMouseOver={() => setHover(tab.id)}
                onMouseOut={() => setHover(undefined)}
              >
                <box onMouseUp={() => tabs.open(tab.id)}>
                  <text
                    fg={foreground(tab.id)}
                    attributes={tabs.active() === tab.id ? TextAttributes.BOLD : undefined}
                    wrapMode="none"
                  >
                    {sessionStripTabLabel(tab, tabs.active() === tab.id)}
                  </text>
                </box>
                <box
                  onMouseUp={(event) => {
                    event.stopPropagation()
                    tabs.close(tab.id)
                  }}
                >
                  <text fg={hover() === tab.id ? theme.text : theme.textMuted} wrapMode="none">
                    {SessionStripText.CLOSE}
                  </text>
                </box>
              </box>
              <text fg={theme.border}>{SessionStripText.SEP}</text>
            </>
          )}
        </For>
        <Show when={layout().hidden > 0}>
          <text fg={theme.textMuted}>{`+${layout().hidden}`}</text>
        </Show>
        <Show when={layout().next}>
          {(id) => (
            <>
              <text fg={theme.border}>{SessionStripText.SEP}</text>
              <box onMouseUp={() => tabs.open(id())}>
                <text fg={theme.textMuted}>{">"}</text>
              </box>
            </>
          )}
        </Show>
      </box>
    </Show>
  )
}
