// Permission UI body for the direct-mode footer.
//
// Renders inside the footer when the reducer pushes a FooterView of type
// "permission". Uses a three-stage state machine (permission.shared.ts):
//
//   permission → shows once / session / project / reject buttons
//   project    → confirmation step before granting durable access
//   reject     → text field for the rejection message
//
// Keyboard: left/right to select, enter to confirm, esc to reject.
// The diff view (when available) uses the same diff component as scrollback
// tool snapshots.
/** @jsxImportSource @opentui/solid */
import type { TextareaRenderable } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { For, Match, Show, Switch, createEffect, createMemo, createSignal } from "solid-js"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { errorMessage } from "@slopcode-ai/tui/util/error"
import {
  createPermissionBodyState,
  createPermissionBatchState,
  permissionBatchMove,
  permissionBatchPersistent,
  permissionBatchReply,
  permissionBatchSubmit,
  permissionBatchSync,
  permissionBatchToggle,
  permissionProjectLines,
  permissionCancel,
  permissionEscape,
  permissionHover,
  permissionInfo,
  permissionLabel,
  permissionOptions,
  permissionReject,
  permissionRun,
  permissionShift,
  type PermissionOption,
  type PermissionBatchOption,
  type PermissionScopeLabel,
} from "./permission.shared"
import { footerWidthPolicy } from "./footer.width"
import { toolFiletype } from "./tool"
import { transparent, type RunBlockTheme, type RunFooterTheme } from "./theme"
import type { PermissionBatchReply, PermissionReply, RunDiffStyle } from "./types"

function buttons(
  list: PermissionOption[],
  selected: PermissionOption,
  theme: RunFooterTheme,
  disabled: boolean,
  scope: PermissionScopeLabel,
  onHover: (option: PermissionOption) => void,
  onSelect: (option: PermissionOption) => void,
) {
  return (
    <box flexDirection="row" gap={1} flexShrink={0}>
      <For each={list}>
        {(option) => (
          <box
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={option === selected ? theme.highlight : transparent}
            onMouseOver={() => {
              if (!disabled) onHover(option)
            }}
            onMouseUp={() => {
              if (!disabled) onSelect(option)
            }}
          >
            <text fg={option === selected ? theme.surface : theme.muted}>{permissionLabel(option, scope)}</text>
          </box>
        )}
      </For>
    </box>
  )
}

/** @internal Exported to test managed textarea submission without permission navigation. */
export function RejectField(props: {
  theme: RunFooterTheme
  text: string
  disabled: boolean
  onChange: (text: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  let area: TextareaRenderable | undefined

  createEffect(() => {
    if (!area || area.isDestroyed) {
      return
    }

    if (area.plainText !== props.text) {
      area.setText(props.text)
      area.cursorOffset = props.text.length
    }

    queueMicrotask(() => {
      if (!area || area.isDestroyed || props.disabled) {
        return
      }
      area.focus()
    })
  })

  return (
    <textarea
      width="100%"
      minHeight={1}
      maxHeight={3}
      wrapMode="word"
      placeholder="Tell SlopCode what to do differently"
      placeholderColor={props.theme.muted}
      textColor={props.theme.text}
      focusedTextColor={props.theme.text}
      backgroundColor={props.theme.surface}
      focusedBackgroundColor={props.theme.surface}
      cursorColor={props.theme.text}
      focused={!props.disabled}
      onSubmit={props.onConfirm}
      onContentChange={() => {
        if (!area || area.isDestroyed) {
          return
        }
        props.onChange(area.plainText)
      }}
      onKeyDown={(event) => {
        if (event.name === "escape") {
          event.preventDefault()
          props.onCancel()
          return
        }
      }}
      ref={(item) => {
        area = item
      }}
    />
  )
}

function RunPermissionSingleBody(props: {
  request: PermissionRequest
  theme: RunFooterTheme
  block: RunBlockTheme
  diffStyle?: RunDiffStyle
  scope: PermissionScopeLabel
  onReply: (input: PermissionReply) => void | Promise<void>
}) {
  const dims = useTerminalDimensions()
  const [state, setState] = createSignal(createPermissionBodyState(props.request.id))
  const info = createMemo(() => permissionInfo(props.request))
  const ft = createMemo(() => toolFiletype(info().file))
  const narrow = createMemo(() => footerWidthPolicy(dims().width).dialog.narrow)
  const persistent = createMemo(() => props.request.always.length > 0)
  const opts = createMemo(() => permissionOptions(state().stage, persistent()))
  const busy = createMemo(() => state().submitting)
  const title = createMemo(() => {
    if (state().stage === "project") {
      return `Always allow for this ${props.scope}`
    }

    if (state().stage === "reject") {
      return "Reject permission"
    }

    return "Permission required"
  })

  createEffect(() => {
    const id = props.request.id
    if (state().requestID === id) {
      return
    }

    setState(createPermissionBodyState(id))
  })

  const shift = (dir: -1 | 1) => {
    setState((prev) => permissionShift(prev, dir, persistent()))
  }

  const submit = async (next: PermissionReply) => {
    setState((prev) => ({
      ...prev,
      submitting: true,
    }))

    try {
      await props.onReply(next)
    } catch {
      setState((prev) => ({
        ...prev,
        submitting: false,
      }))
    }
  }

  const run = (option: PermissionOption) => {
    const cur = state()
    const next = permissionRun(cur, props.request.id, option)
    if (next.state !== cur) {
      setState(next.state)
    }

    if (!next.reply) {
      return
    }

    void submit(next.reply)
  }

  const reject = () => {
    const next = permissionReject(state(), props.request.id)
    if (!next) {
      return
    }

    void submit(next)
  }

  const cancelReject = () => {
    setState((prev) => permissionCancel(prev))
  }

  useKeyboard((event) => {
    const cur = state()
    if (cur.stage === "reject") {
      return
    }

    if (cur.submitting) {
      if (["left", "right", "h", "l", "tab", "return", "escape"].includes(event.name)) {
        event.preventDefault()
      }
      return
    }

    if (event.name === "tab") {
      shift(event.shift ? -1 : 1)
      event.preventDefault()
      return
    }

    if (event.name === "left" || event.name === "h") {
      shift(-1)
      event.preventDefault()
      return
    }

    if (event.name === "right" || event.name === "l") {
      shift(1)
      event.preventDefault()
      return
    }

    if (event.name === "return") {
      run(state().selected)
      event.preventDefault()
      return
    }

    if (event.name !== "escape") {
      return
    }

    setState((prev) => permissionEscape(prev))
    event.preventDefault()
  })

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={props.theme.surface}>
      <box
        flexDirection="column"
        gap={1}
        paddingLeft={1}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexShrink={0}
      >
        <box flexDirection="row" gap={1} paddingLeft={1}>
          <text fg={state().stage === "reject" ? props.theme.error : props.theme.warning}>△</text>
          <text fg={props.theme.text}>{title()}</text>
        </box>
        <Switch>
          <Match when={state().stage === "permission"}>
            <box flexDirection="row" gap={1} paddingLeft={2}>
              <text fg={props.theme.muted} flexShrink={0}>
                {info().icon}
              </text>
              <text fg={props.theme.text} wrapMode="word">
                {info().title}
              </text>
            </box>
          </Match>
          <Match when={state().stage === "reject"}>
            <box paddingLeft={1}>
              <text fg={props.theme.muted}>Tell SlopCode what to do differently</text>
            </box>
          </Match>
        </Switch>
      </box>

      <Show
        when={state().stage !== "reject"}
        fallback={
          <box width="100%" flexGrow={1} flexShrink={1} justifyContent="flex-end">
            <box
              flexDirection={narrow() ? "column" : "row"}
              flexShrink={0}
              backgroundColor={props.theme.line}
              paddingTop={1}
              paddingLeft={2}
              paddingRight={3}
              paddingBottom={1}
              justifyContent={narrow() ? "flex-start" : "space-between"}
              alignItems={narrow() ? "flex-start" : "center"}
              gap={1}
            >
              <box width={narrow() ? "100%" : undefined} flexGrow={1} flexShrink={1}>
                <RejectField
                  theme={props.theme}
                  text={state().message}
                  disabled={busy()}
                  onChange={(text) => {
                    setState((prev) => ({
                      ...prev,
                      message: text,
                    }))
                  }}
                  onConfirm={reject}
                  onCancel={cancelReject}
                />
              </box>
              <Show
                when={!busy()}
                fallback={
                  <text fg={props.theme.muted} wrapMode="word" flexShrink={0}>
                    Waiting for permission event...
                  </text>
                }
              >
                <box flexDirection="row" gap={2} flexShrink={0}>
                  <text fg={props.theme.text}>
                    enter <span style={{ fg: props.theme.muted }}>confirm</span>
                  </text>
                  <text fg={props.theme.text}>
                    esc <span style={{ fg: props.theme.muted }}>cancel</span>
                  </text>
                </box>
              </Show>
            </box>
          </box>
        }
      >
        <box width="100%" flexGrow={1} flexShrink={1} paddingLeft={1} paddingRight={3} paddingBottom={1}>
          <Switch>
            <Match when={state().stage === "permission"}>
              <scrollbox
                width="100%"
                height="100%"
                verticalScrollbarOptions={{
                  trackOptions: {
                    backgroundColor: props.theme.surface,
                    foregroundColor: props.theme.line,
                  },
                }}
              >
                <box width="100%" flexDirection="column" gap={1}>
                  <Show
                    when={info().diff}
                    fallback={
                      <box width="100%" flexDirection="column" gap={1} paddingLeft={1}>
                        <For each={info().lines}>
                          {(line) => (
                            <text fg={props.theme.text} wrapMode="word">
                              {line}
                            </text>
                          )}
                        </For>
                      </box>
                    }
                  >
                    <diff
                      diff={info().diff!}
                      view="unified"
                      filetype={ft()}
                      syntaxStyle={props.block.syntax}
                      showLineNumbers={true}
                      width="100%"
                      wrapMode="word"
                      fg={props.theme.text}
                      addedBg={props.block.diffAddedBg}
                      removedBg={props.block.diffRemovedBg}
                      contextBg={props.block.diffContextBg}
                      addedSignColor={props.block.diffHighlightAdded}
                      removedSignColor={props.block.diffHighlightRemoved}
                      lineNumberFg={props.block.diffLineNumber}
                      lineNumberBg={props.block.diffContextBg}
                      addedLineNumberBg={props.block.diffAddedLineNumberBg}
                      removedLineNumberBg={props.block.diffRemovedLineNumberBg}
                    />
                  </Show>
                  <Show when={!info().diff && info().lines.length === 0}>
                    <box paddingLeft={1}>
                      <text fg={props.theme.muted}>No diff provided</text>
                    </box>
                  </Show>
                </box>
              </scrollbox>
            </Match>
            <Match when={true}>
              <scrollbox
                width="100%"
                height="100%"
                verticalScrollbarOptions={{
                  trackOptions: {
                    backgroundColor: props.theme.surface,
                    foregroundColor: props.theme.line,
                  },
                }}
              >
                <box width="100%" flexDirection="column" gap={1} paddingLeft={1}>
                  <For each={permissionProjectLines(props.request, props.scope)}>
                    {(line) => (
                      <text fg={props.theme.text} wrapMode="word">
                        {line}
                      </text>
                    )}
                  </For>
                </box>
              </scrollbox>
            </Match>
          </Switch>
        </box>

        <box
          flexDirection={narrow() ? "column" : "row"}
          flexShrink={0}
          backgroundColor={props.theme.pane}
          gap={1}
          paddingTop={1}
          paddingLeft={2}
          paddingRight={3}
          paddingBottom={1}
          justifyContent={narrow() ? "flex-start" : "space-between"}
          alignItems={narrow() ? "flex-start" : "center"}
        >
          {buttons(
            opts(),
            state().selected,
            props.theme,
            busy(),
            props.scope,
            (option) => {
              setState((prev) => permissionHover(prev, option))
            },
            run,
          )}
          <Show
            when={!busy()}
            fallback={
              <text fg={props.theme.muted} wrapMode="word" flexShrink={0}>
                Waiting for permission event...
              </text>
            }
          >
            <box flexDirection="row" gap={2} flexShrink={0}>
              <text fg={props.theme.text}>
                {"⇆"} <span style={{ fg: props.theme.muted }}>select</span>
              </text>
              <text fg={props.theme.text}>
                enter <span style={{ fg: props.theme.muted }}>confirm</span>
              </text>
              <text fg={props.theme.text}>
                esc <span style={{ fg: props.theme.muted }}>{state().stage === "project" ? "cancel" : "reject"}</span>
              </text>
            </box>
          </Show>
        </box>
      </Show>
    </box>
  )
}

function RunPermissionBatchBody(props: {
  requests: PermissionRequest[]
  theme: RunFooterTheme
  scope: PermissionScopeLabel
  onReply: (input: PermissionBatchReply) => void | Promise<void>
}) {
  const [state, setState] = createSignal(createPermissionBatchState(props.requests))
  const [selected, setSelected] = createSignal<PermissionBatchOption>("once")
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const persistent = createMemo(() => permissionBatchPersistent(state(), props.requests))
  const options = createMemo<PermissionBatchOption[]>(() =>
    state().stage === "project"
      ? ["confirm", "cancel"]
      : persistent()
        ? ["once", "always", "project", "reject"]
        : ["once", "reject"],
  )

  createEffect(() => {
    const list = options()
    if (!list.includes(selected())) setSelected(list[0])
  })

  createEffect(() => {
    setState((current) => {
      const next = permissionBatchSync(current, props.requests)
      if (current.stage === "project" && next.stage === "review") setSelected("once")
      return next
    })
  })

  const submit = async (reply: PermissionBatchReply) => {
    setSubmitting(true)
    setError(undefined)
    await permissionBatchSubmit({
      send: () => Promise.resolve(props.onReply(reply)),
      error: (error) => setError(errorMessage(error)),
      done: () => setSubmitting(false),
    })
  }

  const run = (option: PermissionBatchOption) => {
    if (submitting()) return
    const current = state()
    const next = permissionBatchReply(current, props.requests, option)
    if (next.state !== current) setState(next.state)
    if (option === "project") setSelected("confirm")
    if (option === "cancel") setSelected("project")
    if (current.stage === "project" && next.state.stage === "review" && option !== "cancel") setSelected("once")
    if (next.reply) void submit(next.reply)
  }

  const shift = (step: number) => {
    const list = options()
    const index = Math.max(0, list.indexOf(selected()))
    setSelected(list[(index + step + list.length) % list.length])
  }

  useKeyboard((event) => {
    if (submitting()) {
      event.preventDefault()
      return
    }
    if (event.name === "up" || event.name === "k") {
      setState((current) => permissionBatchMove(current, props.requests, -1))
      event.preventDefault()
      return
    }
    if (event.name === "down" || event.name === "j") {
      setState((current) => permissionBatchMove(current, props.requests, 1))
      event.preventDefault()
      return
    }
    if (event.name === "space" && state().stage === "review") {
      const request = props.requests[state().focused]
      if (request) setState((current) => permissionBatchToggle(current, request.id))
      event.preventDefault()
      return
    }
    if (event.name === "left" || event.name === "h" || (event.name === "tab" && event.shift)) {
      shift(-1)
      event.preventDefault()
      return
    }
    if (event.name === "right" || event.name === "l" || event.name === "tab") {
      shift(1)
      event.preventDefault()
      return
    }
    if (event.name === "return") {
      run(selected())
      event.preventDefault()
      return
    }
    if (event.name === "escape") {
      run(state().stage === "project" ? "cancel" : "reject")
      event.preventDefault()
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={props.theme.surface}>
      <box flexDirection="column" gap={1} paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0}>
        <box flexDirection="row" gap={1}>
          <text fg={props.theme.warning}>△</text>
          <text fg={props.theme.text}>
            {state().stage === "project" ? `Always allow for this ${props.scope}` : "Review build permissions"}
          </text>
          <text fg={props.theme.muted}>{`(${state().selected.length}/${props.requests.length} selected)`}</text>
        </box>
        <text fg={props.theme.muted}>
          {state().stage === "project"
            ? `This approval survives restarts and remains active for this ${props.scope} until revoked.`
            : "Up/down focuses, space toggles. Unselected permissions are skipped."}
        </text>
        <Show when={error()}>{(message) => <text fg={props.theme.error}>{message()}</text>}</Show>
      </box>
      <scrollbox width="100%" height="100%" paddingLeft={2} paddingRight={2}>
        <box flexDirection="column">
          <For each={props.requests}>
            {(request, index) => {
              const focused = () => index() === state().focused
              const picked = () => state().selected.includes(request.id)
              return (
                <Show when={state().stage === "review" || picked()}>
                  <box
                    flexDirection="column"
                    paddingLeft={1}
                    backgroundColor={focused() ? props.theme.line : transparent}
                    onMouseOver={() => setState((current) => ({ ...current, focused: index() }))}
                    onMouseUp={() => {
                      if (state().stage === "review") setState((current) => permissionBatchToggle(current, request.id))
                    }}
                  >
                    <text fg={focused() ? props.theme.highlight : picked() ? props.theme.text : props.theme.muted}>
                      {`${picked() ? "[x]" : "[ ]"} ${request.permission}: ${
                        state().stage === "project" ? request.always.join(", ") : request.patterns.join(", ")
                      }`}
                    </text>
                    <text fg={props.theme.muted}>{request.reason}</text>
                  </box>
                </Show>
              )
            }}
          </For>
        </box>
      </scrollbox>
      <box
        flexDirection="row"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={props.theme.pane}
      >
        <For each={options()}>
          {(option) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={selected() === option ? props.theme.highlight : transparent}
              onMouseOver={() => setSelected(option)}
              onMouseUp={() => run(option)}
            >
              <text fg={selected() === option ? props.theme.surface : props.theme.muted}>
                {option === "once"
                  ? "Allow selected once"
                  : option === "always"
                    ? "Allow selected for this session"
                    : option === "project"
                      ? `Always allow selected for this ${props.scope}`
                      : option === "reject"
                        ? "Reject all"
                        : permissionLabel(option, props.scope)}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}

export function RunPermissionBody(props: {
  requests: PermissionRequest[]
  theme: RunFooterTheme
  block: RunBlockTheme
  diffStyle?: RunDiffStyle
  scope: PermissionScopeLabel
  onReply: (input: PermissionReply) => void | Promise<void>
  onBatchReply: (input: PermissionBatchReply) => void | Promise<void>
}) {
  return (
    <Show
      when={props.requests[0]?.kind === "forecast"}
      fallback={
        <RunPermissionSingleBody
          request={props.requests[0]}
          theme={props.theme}
          block={props.block}
          diffStyle={props.diffStyle}
          scope={props.scope}
          onReply={props.onReply}
        />
      }
    >
      <RunPermissionBatchBody
        requests={props.requests}
        theme={props.theme}
        scope={props.scope}
        onReply={props.onBatchReply}
      />
    </Show>
  )
}
