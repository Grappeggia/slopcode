import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { fileURLToPath } from "bun"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { For, Match, Switch, Show, createMemo } from "solid-js"
import { createResource } from "solid-js"
import { useRoute } from "../context/route"
import { useSDK } from "../context/sdk"
import { runtimeHint, runtimeOwner } from "../util/session-runtime"
import { useLocal } from "../context/local"
import {
  accountLabel,
  clamp,
  compact,
  creditsLabel,
  hasUsageLimits,
  latestContext,
  resetAt,
  sessionTokens,
  statusBodyHeight,
  windowLabel,
} from "../util/openai-status"
import { getScrollAcceleration } from "../util/scroll"
import { useTuiConfig } from "../config"

export type DialogStatusProps = {}

export function DialogStatus() {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const route = useRoute()
  const sdk = useSDK()
  const local = useLocal()
  const dimensions = useTerminalDimensions()
  const config = useTuiConfig()
  const sessionID = route.data.type === "session" ? route.data.sessionID : undefined
  const [runtime] = createResource(
    () => sessionID,
    async (sessionID) => (await sdk.client.v2.session.runtime({ sessionID }, { throwOnError: true })).data.data,
  )
  const [openai] = createResource(
    () => local.model.current()?.providerID === "openai",
    async (enabled) => {
      if (!enabled) return
      return sdk.client.provider.openai
        .usage({}, { throwOnError: true })
        .then((response) => response.data)
        .catch(() => ({ status: "unavailable" as const }))
    },
  )

  const messages = createMemo(() => (sessionID ? (sync.data.message[sessionID] ?? []) : []))
  const context = createMemo(() => latestContext(messages(), sync.data.provider, "openai"))
  const selected = createMemo(() => {
    const model = local.model.current()
    if (!model) return
    return `${local.model.parsed().model}${local.model.variant.current() ? ` (${local.model.variant.current()})` : ""}`
  })

  const enabledFormatters = createMemo(() => sync.data.formatter.filter((f) => f.enabled))

  const plugins = createMemo(() => {
    const list = sync.data.config.plugin ?? []
    const result = list.map((item) => {
      const value = typeof item === "string" ? item : item[0]
      if (value.startsWith("file://")) {
        const path = fileURLToPath(value)
        const parts = path.split("/")
        const filename = parts.pop() || path
        if (!filename.includes(".")) return { name: filename }
        const basename = filename.split(".")[0]
        if (basename === "index") {
          const dirname = parts.pop()
          const name = dirname || basename
          return { name }
        }
        return { name: basename }
      }
      const index = value.lastIndexOf("@")
      if (index <= 0) return { name: value, version: "latest" }
      const name = value.substring(0, index)
      const version = value.substring(index + 1)
      return { name, version }
    })
    return result.toSorted((a, b) => a.name.localeCompare(b.name))
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Status
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <scrollbox
        maxHeight={statusBodyHeight(dimensions().height)}
        scrollbarOptions={{ visible: false }}
        scrollAcceleration={getScrollAcceleration(config)}
      >
        <box gap={1}>
          <Show when={local.model.current()?.providerID === "openai"}>
            <box>
              <text fg={theme.text}>OpenAI Usage</text>
              <text fg={theme.text} wrapMode="word">
                <b>Model</b> <span style={{ fg: theme.textMuted }}>{selected()}</span>
              </text>
              <Switch fallback={<text fg={theme.textMuted}>Loading account usage...</text>}>
                <Match when={openai()?.status === "disconnected"}>
                  <text fg={theme.textMuted}>ChatGPT disconnected</text>
                </Match>
                <Match when={openai()?.status === "api_key"}>
                  <text fg={theme.textMuted}>API key configured</text>
                </Match>
                <Match when={openai()?.status === "unavailable"}>
                  <text fg={theme.textMuted}>OpenAI usage unavailable</text>
                </Match>
                <Match when={openai()?.status === "oauth" && openai()}>
                  {(value) => {
                    const usage = () => {
                      const current = value()
                      return current?.status === "oauth" ? current : undefined
                    }
                    return (
                      <box>
                        <text fg={theme.text} wrapMode="word">
                          <b>Account</b>{" "}
                          <span style={{ fg: theme.textMuted }}>{usage() ? accountLabel(usage()!) : "ChatGPT"}</span>
                        </text>
                        <Show
                          when={usage() && hasUsageLimits(usage()!)}
                          fallback={<text fg={theme.textMuted}>Limits not available for this account</text>}
                        >
                          <For each={[usage()?.primary, usage()?.secondary].filter((item) => item !== undefined)}>
                            {(item) => (
                              <text fg={theme.text} wrapMode="word">
                                <b>{windowLabel(item.windowMinutes)}</b>{" "}
                                <span style={{ fg: theme.textMuted }}>
                                  {Math.round(clamp(100 - item.usedPercent))}% left
                                  {resetAt(item.resetAt)}
                                </span>
                              </text>
                            )}
                          </For>
                          <Show when={usage()?.credits?.hasCredits ? usage()?.credits : undefined}>
                            {(credits) => (
                              <text fg={theme.text} wrapMode="word">
                                <b>Credits</b> <span style={{ fg: theme.textMuted }}>{creditsLabel(credits())}</span>
                              </text>
                            )}
                          </Show>
                          <Show when={usage()?.spend}>
                            {(spend) => (
                              <text fg={theme.text} wrapMode="word">
                                <b>Monthly spend</b>{" "}
                                <span style={{ fg: theme.textMuted }}>
                                  {spend().used} / {spend().limit} credits ·{" "}
                                  {Math.round(clamp(spend().remainingPercent))}% left
                                  {resetAt(spend().resetAt)}
                                </span>
                              </text>
                            )}
                          </Show>
                        </Show>
                      </box>
                    )
                  }}
                </Match>
              </Switch>
              <Show when={context()}>
                {(info) => (
                  <text fg={theme.text} wrapMode="word">
                    <b>Context</b>{" "}
                    <span style={{ fg: theme.textMuted }}>
                      {info().message.providerID}/{info().message.modelID} · {compact(info().used)} /{" "}
                      {compact(info().full)} · {Math.round(info().leftPercent)}% left
                    </span>
                  </text>
                )}
              </Show>
              <Show when={openai()?.status === "api_key" && sessionID}>
                <text fg={theme.text} wrapMode="word">
                  <b>Session tokens</b>{" "}
                  <span style={{ fg: theme.textMuted }}>{compact(sessionTokens(messages(), "openai"))}</span>
                </text>
              </Show>
              <text fg={theme.textMuted} wrapMode="word">
                https://chatgpt.com/codex/settings/usage
              </text>
            </box>
          </Show>
          <Show when={runtime()}>
            {(info) => (
              <box>
                <text fg={theme.text}>Session Runtime</text>
                <text fg={theme.text} wrapMode="word">
                  <b>{runtimeOwner(info().owner)}</b>{" "}
                  <span style={{ fg: theme.textMuted }}>
                    {info().state} · epoch {info().epoch}
                  </span>
                </text>
                <Show when={runtimeHint(info().state)}>
                  {(hint) => (
                    <text fg={theme.textMuted} wrapMode="word">
                      {hint()}
                    </text>
                  )}
                </Show>
              </box>
            )}
          </Show>
          <Show when={Object.keys(sync.data.mcp).length > 0} fallback={<text fg={theme.text}>No MCP Servers</text>}>
            <box>
              <text fg={theme.text}>{Object.keys(sync.data.mcp).length} MCP Servers</text>
              <For each={Object.entries(sync.data.mcp)}>
                {([key, item]) => (
                  <box flexDirection="row" gap={1}>
                    <text
                      flexShrink={0}
                      style={{
                        fg: (
                          {
                            connected: theme.success,
                            failed: theme.error,
                            disabled: theme.textMuted,
                            needs_auth: theme.warning,
                            needs_client_registration: theme.error,
                          } as Record<string, typeof theme.success>
                        )[item.status],
                      }}
                    >
                      •
                    </text>
                    <text fg={theme.text} wrapMode="word">
                      <b>{key}</b>{" "}
                      <span style={{ fg: theme.textMuted }}>
                        <Switch fallback={item.status}>
                          <Match when={item.status === "connected"}>Connected</Match>
                          <Match when={item.status === "failed" && item}>{(val) => val().error}</Match>
                          <Match when={item.status === "disabled"}>Disabled in configuration</Match>
                          <Match when={(item.status as string) === "needs_auth"}>
                            Needs authentication (run: slopcode mcp auth {key})
                          </Match>
                          <Match when={(item.status as string) === "needs_client_registration" && item}>
                            {(val) => (val() as { error: string }).error}
                          </Match>
                        </Switch>
                      </span>
                    </text>
                  </box>
                )}
              </For>
            </box>
          </Show>
          {sync.data.lsp.length > 0 && (
            <box>
              <text fg={theme.text}>{sync.data.lsp.length} LSP Servers</text>
              <For each={sync.data.lsp}>
                {(item) => (
                  <box flexDirection="row" gap={1}>
                    <text
                      flexShrink={0}
                      style={{
                        fg: {
                          connected: theme.success,
                          error: theme.error,
                        }[item.status],
                      }}
                    >
                      •
                    </text>
                    <text fg={theme.text} wrapMode="word">
                      <b>{item.id}</b> <span style={{ fg: theme.textMuted }}>{item.root}</span>
                    </text>
                  </box>
                )}
              </For>
            </box>
          )}
          <Show when={enabledFormatters().length > 0} fallback={<text fg={theme.text}>No Formatters</text>}>
            <box>
              <text fg={theme.text}>{enabledFormatters().length} Formatters</text>
              <For each={enabledFormatters()}>
                {(item) => (
                  <box flexDirection="row" gap={1}>
                    <text
                      flexShrink={0}
                      style={{
                        fg: theme.success,
                      }}
                    >
                      •
                    </text>
                    <text wrapMode="word" fg={theme.text}>
                      <b>{item.name}</b>
                    </text>
                  </box>
                )}
              </For>
            </box>
          </Show>
          <Show when={plugins().length > 0} fallback={<text fg={theme.text}>No Plugins</text>}>
            <box>
              <text fg={theme.text}>{plugins().length} Plugins</text>
              <For each={plugins()}>
                {(item) => (
                  <box flexDirection="row" gap={1}>
                    <text
                      flexShrink={0}
                      style={{
                        fg: theme.success,
                      }}
                    >
                      •
                    </text>
                    <text wrapMode="word" fg={theme.text}>
                      <b>{item.name}</b>
                      {item.version && <span style={{ fg: theme.textMuted }}> @{item.version}</span>}
                    </text>
                  </box>
                )}
              </For>
            </box>
          </Show>
        </box>
      </scrollbox>
    </box>
  )
}
