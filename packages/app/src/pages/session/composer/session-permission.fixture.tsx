import { renderToString } from "solid-js/web"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { dict } from "@slopcode-ai/ui/i18n/en"
import type { ButtonProps } from "@slopcode-ai/ui/button"
import { SessionPermissionDockView } from "./session-permission-view"

function Button(props: ButtonProps) {
  return <button disabled={props.disabled}>{props.children}</button>
}

export function renderPermissionDock(input: {
  request: PermissionRequest
  scope: "project" | "folder"
  project?: boolean
}) {
  const t = (key: string) => (dict as Record<string, string>)[key] ?? key
  return renderToString(() => (
    <SessionPermissionDockView
      request={input.request}
      responding={false}
      scope={input.scope}
      toolDescription=""
      t={t}
      button={Button}
      icon={<span>!</span>}
      project={input.project}
      onDecide={() => {}}
    />
  ))
}
