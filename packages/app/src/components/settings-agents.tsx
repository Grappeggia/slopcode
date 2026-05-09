import { useParams } from "@solidjs/router"
import { Select } from "@slopcode-ai/ui/select"
import { Tag } from "@slopcode-ai/ui/tag"
import { showToast } from "@slopcode-ai/ui/toast"
import { type Component, For, Show, createMemo } from "solid-js"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { decode64 } from "@/utils/base64"
import { Link } from "./link"

export const SettingsAgents: Component = () => {
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const params = useParams()

  const directory = createMemo(() => decode64(params.dir) ?? "")
  const child = createMemo(() => {
    const dir = directory()
    if (!dir) return
    return globalSync.child(dir, { bootstrap: false })
  })

  const rank = (mode: string) => {
    if (mode === "primary") return 0
    if (mode === "all") return 1
    return 2
  }

  const agents = createMemo(() =>
    (child()?.[0].agent ?? []).slice().sort((a, b) => rank(a.mode) - rank(b.mode) || a.name.localeCompare(b.name)),
  )
  const primary = createMemo(() => agents().filter((agent) => agent.mode !== "subagent" && !agent.hidden))
  const selected = createMemo(() => {
    const configured = child()?.[0].config.default_agent
    if (configured && primary().some((agent) => agent.name === configured)) return configured
    return primary().find((agent) => agent.name === "build")?.name ?? primary()[0]?.name
  })
  const options = createMemo(() => primary().map((agent) => ({ value: agent.name, label: agent.name })))

  const updateDefault = async (name: string) => {
    const current = child()
    if (!current || !name || name === current[0].config.default_agent) return
    const before = current[0].config.default_agent
    current[1]("config", "default_agent", name)
    await globalSync.updateConfig({ default_agent: name }).catch((error) => {
      current[1]("config", "default_agent", before)
      showToast({
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    })
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-2 pt-6 pb-8 max-w-[720px]">
          <div class="flex flex-col gap-1">
            <h2 class="text-16-medium text-text-strong">{language.t("settings.agents.title")}</h2>
            <p class="text-14-regular text-text-weak">
              {language.t("settings.agents.description")}{" "}
              <Link href="https://slopcode.dev/docs/agents">{language.t("common.learnMore")}</Link>
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-[720px]">
        <div
          data-action="settings-default-agent"
          class="border border-border-weak-base rounded-lg overflow-hidden bg-surface-raised-base"
        >
          <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-border-weak-base last:border-none">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-14-medium text-text-strong">Default agent</span>
              <span class="text-12-regular text-text-weak">Used when a session does not specify an agent.</span>
            </div>
            <div class="flex-shrink-0">
              <Show
                when={options().length > 0}
                fallback={<span class="text-12-regular text-text-weak">Loading agents...</span>}
              >
                <Select
                  options={options()}
                  current={options().find((option) => option.value === selected())}
                  value={(option) => option.value}
                  label={(option) => option.label}
                  onSelect={(option) => option && void updateDefault(option.value)}
                  variant="secondary"
                  size="small"
                  triggerVariant="settings"
                />
              </Show>
            </div>
          </div>
        </div>

        <div class="border border-border-weak-base rounded-lg overflow-hidden bg-surface-raised-base">
          <Show
            when={agents().length > 0}
            fallback={<div class="py-8 px-4 text-14-regular text-text-weak">No agents available.</div>}
          >
            <For each={agents()}>
              {(agent) => {
                const model = () => (agent.model ? `${agent.model.providerID}/${agent.model.modelID}` : undefined)
                return (
                  <div class="flex flex-col gap-2 px-4 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-14-medium text-text-strong">{agent.name}</span>
                      <Tag>{agent.mode}</Tag>
                      <Show when={agent.name === selected()}>
                        <Tag>{language.t("common.default")}</Tag>
                      </Show>
                      <Show when={agent.hidden}>
                        <Tag>hidden</Tag>
                      </Show>
                      <Show when={agent.native}>
                        <Tag>native</Tag>
                      </Show>
                    </div>

                    <Show when={agent.description}>
                      <p class="text-12-regular text-text-weak">{agent.description}</p>
                    </Show>

                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-12-regular text-text-weak">
                      <Show when={model()}>
                        {(value) => <code class="rounded bg-surface-base px-1.5 py-0.5 text-text-base">{value()}</code>}
                      </Show>
                      <Show when={agent.variant}>{(value) => <span>{value()}</span>}</Show>
                      <Show when={agent.steps}>{(value) => <span>{value()} steps</span>}</Show>
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
