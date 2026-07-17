import { renderToString } from "solid-js/web"
import { createSlopcodeClient, type PermissionRequest } from "@slopcode-ai/sdk/v2"
import { dict } from "@slopcode-ai/ui/i18n/en"
import type { ButtonProps } from "@slopcode-ai/ui/button"
import { permissionRespond } from "./session-permission"
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

export async function respondPermission() {
  const bodies: unknown[] = []
  const client = createSlopcodeClient({
    baseUrl: "http://localhost",
    fetch: Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(await new Request(input, init).json())
        return new Response(JSON.stringify(true), { headers: { "content-type": "application/json" } })
      },
      { preconnect: () => undefined },
    ),
  })

  await permissionRespond(client, { id: "per_one", sessionID: "ses_one" }, "always", "/work")
  await permissionRespond(client, { id: "per_two", sessionID: "ses_one" }, "project", "/work")
  return bodies
}
