import { useParams } from "@solidjs/router"
import { IconButton } from "@slopcode-ai/ui/icon-button"
import { Icon } from "@slopcode-ai/ui/icon"
import { Switch } from "@slopcode-ai/ui/switch"
import { TextField } from "@slopcode-ai/ui/text-field"
import { showToast } from "@slopcode-ai/ui/toast"
import { type Component, For, Show, createMemo, createSignal } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { decode64 } from "@/utils/base64"

export const SettingsMcp: Component = () => {
  const globalSDK = useGlobalSDK()
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const params = useParams()
  const [filter, setFilter] = createSignal("")
  const [loading, setLoading] = createSignal<string | null>(null)

  const directory = createMemo(() => decode64(params.dir) ?? "")
  const child = createMemo(() => {
    const dir = directory()
    if (!dir) return
    return globalSync.child(dir, { bootstrap: false })
  })
  const sdk = createMemo(() => {
    const dir = directory()
    if (!dir) return
    return globalSDK.createClient({ directory: dir, throwOnError: true })
  })

  const statusLabel = (status: string) => {
    if (status === "connected") return language.t("mcp.status.connected")
    if (status === "failed") return language.t("mcp.status.failed")
    if (status === "needs_auth") return language.t("mcp.status.needs_auth")
    if (status === "disabled") return language.t("mcp.status.disabled")
    return status.replaceAll("_", " ")
  }

  const items = createMemo(() =>
    Object.entries(child()?.[0].mcp ?? {})
      .map(([name, status]) => ({ name, status }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
  const filtered = createMemo(() => {
    const query = filter().trim().toLowerCase()
    if (!query) return items()
    return items().filter((item) => {
      const config = child()?.[0].config.mcp?.[item.name]
      const source =
        config && "type" in config
          ? config.type === "local"
            ? config.command.join(" ")
            : config.url
          : undefined
      return [item.name, item.status.status, item.status.status === "failed" ? item.status.error : undefined, source]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    })
  })
  const connected = createMemo(() => items().filter((item) => item.status.status === "connected").length)

  const toggle = async (name: string) => {
    const client = sdk()
    const current = child()
    if (!client || !current || loading()) return
    setLoading(name)
    try {
      const status = current[0].mcp[name]
      await (status?.status === "connected" ? client.mcp.disconnect({ name }) : client.mcp.connect({ name }))
      const result = await client.mcp.status()
      if (result.data) current[1]("mcp", result.data)
    } catch (error) {
      showToast({
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-4 pt-6 pb-8 max-w-[720px]">
          <div class="flex flex-col gap-1">
            <h2 class="text-16-medium text-text-strong">{language.t("settings.mcp.title")}</h2>
            <p class="text-14-regular text-text-weak">
              {language.t("dialog.mcp.description", { enabled: connected(), total: items().length })}
            </p>
          </div>

          <Show when={items().length > 0}>
            <div class="flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-base max-w-[720px]">
              <Icon name="magnifying-glass" class="text-icon-weak-base flex-shrink-0" />
              <TextField
                variant="ghost"
                type="text"
                value={filter()}
                onChange={setFilter}
                placeholder={language.t("common.search.placeholder")}
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                class="flex-1"
              />
              <Show when={filter()}>
                <IconButton icon="circle-x" variant="ghost" onClick={() => setFilter("")} />
              </Show>
            </div>
          </Show>
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-[720px]">
        <div class="border border-border-weak-base rounded-lg overflow-hidden bg-surface-raised-base">
          <Show when={filtered().length > 0} fallback={<div class="py-8 px-4 text-14-regular text-text-weak">{language.t("dialog.mcp.empty")}</div>}>
            <For each={filtered()}>
              {(item) => {
                const config = () => child()?.[0].config.mcp?.[item.name]
                const source = () => {
                  const value = config()
                  if (!value || !("type" in value)) return
                  if (value.type === "local") return value.command.join(" ")
                  return value.url
                }
                const error = () => (item.status.status === "failed" ? item.status.error : undefined)

                return (
                  <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex flex-col gap-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-14-medium text-text-strong">{item.name}</span>
                        <span class="text-12-regular text-text-weak">{statusLabel(item.status.status)}</span>
                        <Show when={loading() === item.name}>
                          <span class="text-12-regular text-text-weak">{language.t("common.loading.ellipsis")}</span>
                        </Show>
                      </div>
                      <Show when={source()}>
                        {(value) => (
                          <code class="text-12-regular text-text-weak whitespace-pre-wrap break-all rounded bg-surface-base px-1.5 py-0.5 self-start">
                            {value()}
                          </code>
                        )}
                      </Show>
                      <Show when={error()}>
                        {(value) => <span class="text-12-regular text-text-weak whitespace-pre-wrap break-all">{value()}</span>}
                      </Show>
                    </div>

                    <div class="flex-shrink-0">
                      <Switch checked={item.status.status === "connected"} disabled={loading() === item.name} onChange={() => void toggle(item.name)}>
                        {item.name}
                      </Switch>
                    </div>
                  </div>
                )
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
