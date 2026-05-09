import { useParams } from "@solidjs/router"
import { IconButton } from "@slopcode-ai/ui/icon-button"
import { Icon } from "@slopcode-ai/ui/icon"
import { Tag } from "@slopcode-ai/ui/tag"
import { TextField } from "@slopcode-ai/ui/text-field"
import { type Component, For, Show, createMemo, createSignal } from "solid-js"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { decode64 } from "@/utils/base64"
import { Link } from "./link"

export const SettingsCommands: Component = () => {
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const params = useParams()
  const [filter, setFilter] = createSignal("")

  const directory = createMemo(() => decode64(params.dir) ?? "")
  const child = createMemo(() => {
    const dir = directory()
    if (!dir) return
    return globalSync.child(dir, { bootstrap: false })
  })

  const commands = createMemo(() => (child()?.[0].command ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)))
  const filtered = createMemo(() => {
    const query = filter().trim().toLowerCase()
    if (!query) return commands()
    return commands().filter((command) =>
      [command.name, command.description, command.template, command.agent, command.model, command.source, ...command.hints]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    )
  })

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-4 pt-6 pb-8 max-w-[720px]">
          <div class="flex flex-col gap-1">
            <h2 class="text-16-medium text-text-strong">{language.t("settings.commands.title")}</h2>
            <p class="text-14-regular text-text-weak">
              {language.t("settings.commands.description")} <Link href="https://slopcode.dev/docs/commands">{language.t("common.learnMore")}</Link>
            </p>
          </div>

          <Show when={commands().length > 0}>
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
          <Show
            when={filtered().length > 0}
            fallback={<div class="py-8 px-4 text-14-regular text-text-weak">{filter().trim() ? language.t("prompt.popover.emptyCommands") : "No commands configured."}</div>}
          >
            <For each={filtered()}>
              {(command) => (
                <div class="flex flex-col gap-2 px-4 py-3 border-b border-border-weak-base last:border-none">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-14-medium text-text-strong">/{command.name}</span>
                    <Show when={command.source}>
                      {(source) => <Tag>{source()}</Tag>}
                    </Show>
                    <Show when={command.subtask}>
                      <Tag>subtask</Tag>
                    </Show>
                    <Show when={command.agent}>
                      {(agent) => <Tag>@{agent()}</Tag>}
                    </Show>
                  </div>

                  <Show when={command.description}>
                    <p class="text-12-regular text-text-weak">{command.description}</p>
                  </Show>

                  <code class="block rounded-md bg-surface-base px-2 py-1 text-12-regular text-text-base whitespace-pre-wrap break-all">
                    {command.template}
                  </code>

                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-12-regular text-text-weak">
                    <Show when={command.model}>
                      {(model) => <code class="rounded bg-surface-base px-1.5 py-0.5 text-text-base">{model()}</code>}
                    </Show>
                    <Show when={command.hints.length > 0}>
                      <div class="flex flex-wrap gap-1.5">
                        <For each={command.hints}>{(hint) => <code class="rounded bg-surface-base px-1.5 py-0.5">{hint}</code>}</For>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
