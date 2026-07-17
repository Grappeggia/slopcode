import { For, Show } from "solid-js"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { Button } from "@slopcode-ai/ui/button"
import { DockPrompt } from "@slopcode-ai/ui/dock-prompt"
import { Icon } from "@slopcode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { createStore } from "solid-js/store"
import { permissionScope, type PermissionDecision } from "./session-permission"

export function SessionPermissionDock(props: {
  request: PermissionRequest
  responding: boolean
  onDecide: (response: PermissionDecision) => void
}) {
  const language = useLanguage()
  const sync = useSync()
  const [store, setStore] = createStore({ project: false })
  const scope = () => permissionScope(sync.project?.vcs)

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.permission}.description`
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
            {store.project
              ? language.t(scope() === "project" ? "ui.permission.confirmProject" : "ui.permission.confirmFolder")
              : language.t("notification.permission.title")}
          </div>
        </div>
      }
      footer={
        <>
          <div />
          <div data-slot="permission-footer-actions">
            <Show
              when={store.project}
              fallback={
                <>
                  <Button
                    variant="ghost"
                    size="normal"
                    onClick={() => props.onDecide("reject")}
                    disabled={props.responding}
                  >
                    {language.t("ui.permission.deny")}
                  </Button>
                  <Show when={props.request.always.length > 0}>
                    <Button
                      variant="secondary"
                      size="normal"
                      onClick={() => props.onDecide("always")}
                      disabled={props.responding}
                    >
                      {language.t("ui.permission.allowSession")}
                    </Button>
                    <Button
                      variant="secondary"
                      size="normal"
                      onClick={() => setStore("project", true)}
                      disabled={props.responding}
                    >
                      {language.t(scope() === "project" ? "ui.permission.allowProject" : "ui.permission.allowFolder")}
                    </Button>
                  </Show>
                  <Button
                    variant="primary"
                    size="normal"
                    onClick={() => props.onDecide("once")}
                    disabled={props.responding}
                  >
                    {language.t("ui.permission.allowOnce")}
                  </Button>
                </>
              }
            >
              <Button variant="ghost" size="normal" onClick={() => setStore("project", false)}>
                {language.t("ui.common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="normal"
                onClick={() => props.onDecide("project")}
                disabled={props.responding}
              >
                {language.t("ui.common.confirm")}
              </Button>
            </Show>
          </div>
        </>
      }
    >
      <Show when={!store.project && toolDescription()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">{toolDescription()}</div>
        </div>
      </Show>

      <Show when={store.project}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">
            {language.t(scope() === "project" ? "ui.permission.persistProject" : "ui.permission.persistFolder")}
          </div>
        </div>
      </Show>

      <Show when={(store.project ? props.request.always : props.request.patterns).length > 0}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-patterns">
            <Show when={store.project}>
              <span data-slot="permission-hint">{language.t("ui.permission.exactPatterns")}</span>
            </Show>
            <For each={store.project ? props.request.always : props.request.patterns}>
              {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
            </For>
          </div>
        </div>
      </Show>
    </DockPrompt>
  )
}
