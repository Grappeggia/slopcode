import { safeExternalUrl } from "../security"

type Decision = { action: "internal" | "deny" } | { action: "external"; url: string }

function classify(value: string, page: string): Decision {
  if (!URL.canParse(page) || !URL.canParse(value, page)) return { action: "deny" }
  const current = new URL(page)
  const url = new URL(value, current)
  if (
    url.protocol === current.protocol &&
    url.hostname === current.hostname &&
    url.port === current.port &&
    url.username === current.username &&
    url.password === current.password
  )
    return { action: "internal" }

  const external = safeExternalUrl(url.toString())
  if (external) return { action: "external", url: external }
  return { action: "deny" }
}

export function handleLinkClick(event: MouseEvent, page: string, open: (url: string) => void) {
  if (event.defaultPrevented || event.button !== 0) return
  const target = event.target as { closest?: (selector: string) => Element | null } | null
  const link = target?.closest?.("a[href]")
  const href = link?.getAttribute("href")
  if (href === null || href === undefined) return

  const decision = classify(href, page)
  if (decision.action === "internal") return
  event.preventDefault()
  if (decision.action === "external") open(decision.url)
}
