import { createEffect, For, Show, type Component, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import type { ButtonProps } from "@slopcode-ai/ui/button"
import { DockPrompt } from "@slopcode-ai/ui/dock-prompt"
import type { PermissionDecision } from "./session-permission"

export function SessionPermissionDockView(props: {
  request: PermissionRequest
  responding: boolean
  scope?: "project" | "folder"
  toolDescription: string
  t: (key: string) => string
  button: Component<ButtonProps>
  icon: JSX.Element
  project?: boolean
  onDecide: (response: PermissionDecision) => void
}) {
  const [store, setStore] = createStore({ project: props.project ?? false })
  const Button = props.button
  const project = () => store.project && props.scope !== undefined

  createEffect(() => {
    if (!props.scope) setStore("project", false)
  })

  return (
    <DockPrompt
      kind="permission"
      header={
        <div data-slot="permission-row" data-variant="header">
          <span data-slot="permission-icon">{props.icon}</span>
          <div data-slot="permission-header-title">
            {project()
              ? props.t(props.scope === "project" ? "ui.permission.confirmProject" : "ui.permission.confirmFolder")
              : props.t("notification.permission.title")}
          </div>
        </div>
      }
      footer={
        <>
          <div />
          <div data-slot="permission-footer-actions">
            <Show
              when={project()}
              fallback={
                <>
                  <Button
                    variant="ghost"
                    size="normal"
                    onClick={() => props.onDecide("reject")}
                    disabled={props.responding}
                  >
                    {props.t("ui.permission.deny")}
                  </Button>
                  <Show when={props.request.always.length > 0}>
                    <Button
                      variant="secondary"
                      size="normal"
                      onClick={() => props.onDecide("always")}
                      disabled={props.responding}
                    >
                      {props.t("ui.permission.allowSession")}
                    </Button>
                    <Show when={props.scope}>
                      <Button
                        variant="secondary"
                        size="normal"
                        onClick={() => setStore("project", true)}
                        disabled={props.responding}
                      >
                        {props.t(
                          props.scope === "project" ? "ui.permission.allowProject" : "ui.permission.allowFolder",
                        )}
                      </Button>
                    </Show>
                  </Show>
                  <Button
                    variant="primary"
                    size="normal"
                    onClick={() => props.onDecide("once")}
                    disabled={props.responding}
                  >
                    {props.t("ui.permission.allowOnce")}
                  </Button>
                </>
              }
            >
              <Button variant="ghost" size="normal" onClick={() => setStore("project", false)}>
                {props.t("ui.common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="normal"
                onClick={() => {
                  if (props.scope) props.onDecide("project")
                }}
                disabled={props.responding}
              >
                {props.t("ui.common.confirm")}
              </Button>
            </Show>
          </div>
        </>
      }
    >
      <Show when={!project() && props.toolDescription}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">{props.toolDescription}</div>
        </div>
      </Show>

      <Show when={project()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">
            {props.t(props.scope === "project" ? "ui.permission.persistProject" : "ui.permission.persistFolder")}
          </div>
        </div>
      </Show>

      <Show when={(project() ? props.request.always : props.request.patterns).length > 0}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-patterns">
            <Show when={project()}>
              <span data-slot="permission-hint">{props.t("ui.permission.exactPatterns")}</span>
            </Show>
            <For each={project() ? props.request.always : props.request.patterns}>
              {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
            </For>
          </div>
        </div>
      </Show>
    </DockPrompt>
  )
}
