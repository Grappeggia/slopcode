import type { WebContents } from "electron"
import { focusDebugRequested } from "../focus-debug"

const owners = new WeakSet<WebContents>()
const nodes = new WeakMap<WebContents, number[]>()
const selector = `
  a[href],
  button:not([disabled]),
  input:not([disabled]),
  select:not([disabled]),
  textarea:not([disabled]),
  summary,
  [contenteditable="true"],
  [tabindex]:not([tabindex="-1"])
`

export function focusDebugEnabled(packaged: boolean, value = process.env.SLOPCODE_FOCUS_DEBUG) {
  return !packaged && focusDebugRequested(value)
}

export async function setForceFocus(contents: WebContents, enabled: boolean, allowed: boolean) {
  if (!allowed) throw new Error("Focus debug is disabled")
  const api = contents.debugger

  if (!enabled) {
    if (!owners.has(contents)) return
    await Promise.allSettled(
      (nodes.get(contents) ?? []).map((nodeId) =>
        api.sendCommand("CSS.forcePseudoState", {
          nodeId,
          forcedPseudoClasses: [],
        }),
      ),
    )
    nodes.delete(contents)
    owners.delete(contents)
    if (api.isAttached()) api.detach()
    return
  }

  if (api.isAttached() && !owners.has(contents)) {
    throw new Error("Developer tools debugger is already attached")
  }
  if (!api.isAttached()) {
    api.attach("1.3")
    owners.add(contents)
    api.once("detach", () => {
      owners.delete(contents)
      nodes.delete(contents)
    })
  }

  await api.sendCommand("DOM.enable")
  await api.sendCommand("CSS.enable")
  const document: unknown = await api.sendCommand("DOM.getDocument", { depth: -1, pierce: true })
  const result: unknown = await api.sendCommand("DOM.querySelectorAll", {
    nodeId: readDocumentNodeId(document),
    selector,
  })
  const ids = readNodeIds(result)
  nodes.set(contents, [...new Set([...(nodes.get(contents) ?? []), ...ids])])
  await Promise.allSettled(
    ids.map((nodeId) =>
      api.sendCommand("CSS.forcePseudoState", {
        nodeId,
        forcedPseudoClasses: ["focus", "focus-visible"],
      }),
    ),
  )
}

function readDocumentNodeId(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("root" in value) ||
    !value.root ||
    typeof value.root !== "object" ||
    !("nodeId" in value.root) ||
    typeof value.root.nodeId !== "number"
  ) {
    throw new Error("Invalid DOM.getDocument response")
  }
  return value.root.nodeId
}

function readNodeIds(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("nodeIds" in value) ||
    !Array.isArray(value.nodeIds) ||
    !value.nodeIds.every((nodeId) => typeof nodeId === "number")
  ) {
    throw new Error("Invalid DOM.querySelectorAll response")
  }
  return value.nodeIds
}
