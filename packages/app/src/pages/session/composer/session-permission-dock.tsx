import { createEffect, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { Button } from "@slopcode-ai/ui/button"
import { DockPrompt } from "@slopcode-ai/ui/dock-prompt"
import { Icon } from "@slopcode-ai/ui/icon"
import { useLanguage } from "@/context/language"

export function SessionPermissionDock(props: {
  requests: PermissionRequest[]
  responding: boolean
  onDecide: (response: "once" | "always" | "reject", permissionIDs: string[]) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    selected: [] as string[],
    known: [] as string[],
  })

  createEffect(() => {
    const ids = props.requests.map((item) => item.id)
    setStore((value) => {
      const selected = value.selected.filter((id) => ids.includes(id))
      const known = value.known.filter((id) => ids.includes(id))
      for (const id of ids) {
        if (known.includes(id)) continue
        known.push(id)
        selected.push(id)
      }
      return {
        selected,
        known,
      }
    })
  })

  const selected = () => props.requests.filter((item) => store.selected.includes(item.id))

  const toggle = (id: string) => {
    setStore("selected", (value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id]))
  }

  const toolDescription = (request: PermissionRequest) => {
    const key = `settings.permissions.tool.${request.permission}.description`
    const value = language.t(key as Parameters<typeof language.t>[0])
    if (value === key) return ""
    return value
  }

  return (
    <DockPrompt
      kind="permission"
      header={
        <div data-slot="permission-row" data-variant="header">
          <span data-slot="permission-icon">
            <Icon name="warning" size="normal" />
          </span>
          <div data-slot="permission-header-title">
            {props.requests.every((item) => item.kind === "forecast")
              ? "Review build permissions"
              : language.t("notification.permission.title")}
          </div>
        </div>
      }
      footer={
        <>
          <div class="text-12-regular text-text-weak">{`${selected().length}/${props.requests.length} selected`}</div>
          <div data-slot="permission-footer-actions">
            <Button
              variant="ghost"
              size="normal"
              onClick={() =>
                props.onDecide(
                  "reject",
                  selected().map((item) => item.id),
                )
              }
              disabled={props.responding || selected().length === 0}
            >
              {language.t("ui.permission.deny")}
            </Button>
            <Button
              variant="secondary"
              size="normal"
              onClick={() =>
                props.onDecide(
                  "always",
                  selected().map((item) => item.id),
                )
              }
              disabled={props.responding || selected().length === 0}
            >
              {language.t("ui.permission.allowAlways")}
            </Button>
            <Button
              variant="primary"
              size="normal"
              onClick={() =>
                props.onDecide(
                  "once",
                  selected().map((item) => item.id),
                )
              }
              disabled={props.responding || selected().length === 0}
            >
              {language.t("ui.permission.allowOnce")}
            </Button>
          </div>
        </>
      }
    >
      <Show when={props.requests.length > 1}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">Use the checked items below to approve only the permissions you want.</div>
        </div>
      </Show>

      <div class="flex flex-col gap-3">
        <For each={props.requests}>
          {(request) => (
            <label class="flex flex-col gap-2 rounded-md border border-border-weak-base px-3 py-2 cursor-pointer">
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={store.selected.includes(request.id)}
                  onChange={() => toggle(request.id)}
                  disabled={props.responding}
                  aria-label={request.permission}
                  class="mt-0.5 size-4 rounded border-border-strong-base"
                />
                <div class="min-w-0 flex-1 flex flex-col gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-13-medium text-text-base break-all">{request.permission}</span>
                    <Show when={request.kind === "forecast"}>
                      <span class="text-11-medium uppercase tracking-[0.12em] text-text-weak">planned</span>
                    </Show>
                  </div>
                  <Show when={toolDescription(request)}>
                    <div data-slot="permission-hint">{toolDescription(request)}</div>
                  </Show>
                  <Show when={request.reason}>
                    <div data-slot="permission-hint">{request.reason}</div>
                  </Show>
                  <Show when={request.patterns.length > 0}>
                    <div data-slot="permission-patterns">
                      <For each={request.patterns}>
                        {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            </label>
          )}
        </For>
      </div>
    </DockPrompt>
  )
}
