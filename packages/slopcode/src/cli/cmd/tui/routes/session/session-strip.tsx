import { useTerminalDimensions } from "@opentui/solid"
import { TextAttributes, type RGBA } from "@opentui/core"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useSessionTabs } from "@tui/context/session-tabs"
import { useTheme } from "@tui/context/theme"
import {
  layoutSessionStrip,
  layoutSessionStripUnderlineSegments,
  sessionStripTabClose,
  sessionStripTabLabel,
  sessionStripWidth,
  SessionStripText,
  type SessionStripTab,
  type SessionStripUnderlineSegment,
} from "./session-strip-layout"

const INSET = 0
const ACTION = "__action__"
const EXPLORER = "📂"

type SessionStripAction = {
  label: string
  active: boolean
  onSelect(): void
}

type SessionStripViewProps = {
  tabs: SessionStripTab[]
  active?: string
  hidden: number
  prev?: string
  next?: string
  underlineSegments: SessionStripUnderlineSegment[]
  colors: {
    accent: RGBA
    edge: RGBA
    hover: RGBA
    panel: RGBA
    text: RGBA
    muted: RGBA
  }
  open(id: string): void
  close(id: string): void
  action?: SessionStripAction
}

type SessionStripProps = {
  action?: Omit<SessionStripAction, "label">
}

export function SessionStripView(props: SessionStripViewProps) {
  const [hover, setHover] = createSignal<string>()
  const prev = "__prev__"
  const next = "__next__"
  const bg = (id: string) => (hover() === id ? props.colors.hover : props.colors.panel)
  const owners = (...ids: Array<string | undefined>) => ids.filter((id): id is string => !!id)
  const fill = (owners: string[]) => (owners.some((id) => hover() === id) ? props.colors.hover : props.colors.panel)
  const sep = (owners: string[]) => (
    <box backgroundColor={fill(owners)}>
      <text fg={props.colors.edge}>{SessionStripText.SEP}</text>
    </box>
  )
  const closeVisible = (id: string) => hover() === id
  const closeFg = (id: string) => (closeVisible(id) ? props.colors.text : props.colors.muted)
  const controlFg = (id: string) => (hover() === id ? props.colors.text : props.colors.muted)
  const actionLead = () => !!(props.prev || props.tabs.length > 0 || props.hidden > 0 || props.next)
  const actionFg = () => {
    if (!props.action) return props.colors.muted
    if (props.action.active) return props.colors.accent
    if (hover() === ACTION) return props.colors.text
    return props.colors.muted
  }

  return (
    <box flexShrink={0} flexDirection="column" backgroundColor={props.colors.panel}>
      <box height={1} flexDirection="row" paddingLeft={INSET} paddingRight={INSET}>
        <Show when={props.prev}>
          {(id) => (
            <>
              <box
                backgroundColor={bg(prev)}
                onMouseOver={() => setHover(prev)}
                onMouseOut={() => setHover(undefined)}
                onMouseUp={() => props.open(id())}
              >
                <text fg={controlFg(prev)} wrapMode="none">
                  {SessionStripText.PREV}
                </text>
              </box>
              {sep(owners(prev, props.tabs[0]?.id))}
            </>
          )}
        </Show>
        <Show when={!props.prev && props.tabs.length > 0}>{sep(owners(props.tabs[0]?.id))}</Show>
        <For each={props.tabs}>
          {(tab, index) => {
            const active = () => props.active === tab.id
            const fg = () => {
              if (active()) return props.colors.accent
              if (hover() === tab.id) return props.colors.text
              return props.colors.muted
            }
            const shared = () =>
              owners(
                tab.id,
                props.tabs[index() + 1]?.id ?? (props.hidden > 0 ? undefined : props.next ? next : undefined),
              )
            return (
              <>
                <box
                  flexDirection="row"
                  backgroundColor={bg(tab.id)}
                  onMouseOver={() => setHover(tab.id)}
                  onMouseOut={() => setHover(undefined)}
                >
                  <box flexDirection="row" onMouseUp={() => props.open(tab.id)}>
                    <box backgroundColor={bg(tab.id)} paddingRight={1}>
                      <text fg={fg()} attributes={active() ? TextAttributes.BOLD : undefined} wrapMode="none">
                        {sessionStripTabLabel(tab, active())}
                      </text>
                    </box>
                  </box>
                  <box
                    width={1}
                    backgroundColor={bg(tab.id)}
                    onMouseUp={
                      closeVisible(tab.id)
                        ? (evt) => {
                            evt.stopPropagation()
                            setHover(undefined)
                            props.close(tab.id)
                          }
                        : undefined
                    }
                  >
                    <text fg={closeFg(tab.id)} wrapMode="none">
                      {sessionStripTabClose(closeVisible(tab.id))}
                    </text>
                  </box>
                </box>
                {sep(shared())}
              </>
            )
          }}
        </For>
        <Show when={props.hidden > 0}>
          <text fg={props.colors.muted}>{`+${props.hidden}`}</text>
        </Show>
        <Show when={props.next}>
          {(id) => (
            <>
              {sep(owners(next))}
              <box
                backgroundColor={bg(next)}
                onMouseOver={() => setHover(next)}
                onMouseOut={() => setHover(undefined)}
                onMouseUp={() => props.open(id())}
              >
                <text fg={controlFg(next)} wrapMode="none">
                  {SessionStripText.NEXT}
                </text>
              </box>
            </>
          )}
        </Show>
        <Show when={props.action}>
          {(action) => (
            <>
              <Show when={actionLead()}>{sep(owners(props.next ? next : props.tabs.at(-1)?.id, ACTION))}</Show>
              <box
                backgroundColor={bg(ACTION)}
                onMouseOver={() => setHover(ACTION)}
                onMouseOut={() => setHover(undefined)}
                onMouseUp={action().onSelect}
              >
                <text fg={actionFg()} attributes={action().active ? TextAttributes.BOLD : undefined} wrapMode="none">
                  {action().label}
                </text>
              </box>
            </>
          )}
        </Show>
      </box>
      <box height={1} flexDirection="row" paddingLeft={INSET} paddingRight={INSET}>
        <For each={props.underlineSegments}>
          {(segment) => (
            <box flexShrink={0} backgroundColor={fill(segment.owners)}>
              <text fg={props.colors.edge} wrapMode="none">
                {segment.text}
              </text>
            </box>
          )}
        </For>
        <Show when={props.action}>
          {(action) => (
            <box flexShrink={0} backgroundColor={fill([ACTION])}>
              <text fg={props.colors.edge} wrapMode="none">
                {`${actionLead() ? "┴" : ""}${"─".repeat(Bun.stringWidth(action().label))}`}
              </text>
            </box>
          )}
        </Show>
      </box>
    </box>
  )
}

export function SessionStrip(props: SessionStripProps = {}) {
  const tabs = useSessionTabs()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const items = createMemo(() =>
    tabs.tabs().map((tab) => ({
      id: tab.id,
      status: tab.status,
      title: tab.title,
    })),
  )
  const action = createMemo(() =>
    props.action
      ? {
          label: EXPLORER,
          active: props.action.active,
          onSelect: props.action.onSelect,
        }
      : undefined,
  )
  const width = createMemo(() => {
    const total = sessionStripWidth(dimensions().width, INSET)
    if (!action()) return total
    return Math.max(0, total - Bun.stringWidth(SessionStripText.SEP + action()!.label))
  })
  const layout = createMemo(() =>
    layoutSessionStrip(items(), {
      active: tabs.active(),
      width: width(),
    }),
  )
  const underlineSegments = createMemo(() =>
    layoutSessionStripUnderlineSegments(layout(), {
      active: tabs.active(),
      prevOwner: "__prev__",
      nextOwner: "__next__",
    }),
  )
  const colors = createMemo(() => ({
    accent: theme.accent,
    edge: theme.border,
    hover: theme.backgroundElement,
    panel: theme.backgroundPanel,
    text: theme.text,
    muted: theme.textMuted,
  }))

  return (
    <Show when={tabs.visible()}>
      <SessionStripView
        tabs={layout().tabs}
        active={tabs.active()}
        hidden={layout().hidden}
        prev={layout().prev}
        next={layout().next}
        underlineSegments={underlineSegments()}
        colors={colors()}
        open={(id) => tabs.open(id)}
        close={(id) => tabs.close(id)}
        action={action()}
      />
    </Show>
  )
}
