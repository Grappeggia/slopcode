import type { AssistantMessage, Message, Provider } from "@slopcode-ai/sdk/v2"

type Account =
  | { status: "disconnected" | "api_key" | "unavailable" }
  | { status: "oauth"; plan: string; email?: string }

export function accountLabel(account: Account) {
  if (account.status === "api_key") return "API key configured"
  if (account.status === "disconnected") return "ChatGPT disconnected"
  if (account.status === "unavailable") return "OpenAI usage unavailable"
  if (account.status !== "oauth") return "ChatGPT"
  const plan = account.plan
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
  return account.email ? `${account.email} (${plan})` : plan || "ChatGPT"
}

export function clamp(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function windowLabel(minutes: number | undefined) {
  if (minutes === undefined) return "Usage limit"
  if (minutes === 300) return "5h"
  if (minutes === 1_440) return "Daily"
  if (minutes === 10_080) return "Weekly"
  if (minutes >= 40_000 && minutes <= 45_000) return "Monthly"
  if (minutes >= 520_000 && minutes <= 530_000) return "Annual"
  if (minutes % 1_440 === 0) return `${minutes / 1_440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

export function tokens(message: AssistantMessage) {
  return (
    message.tokens.total ??
    message.tokens.input +
      message.tokens.output +
      message.tokens.reasoning +
      message.tokens.cache.read +
      message.tokens.cache.write
  )
}

export function latestContext(messages: Message[], providers: Provider[], providerID: string) {
  const message = messages.findLast(
    (item): item is AssistantMessage => item.role === "assistant" && item.providerID === providerID && tokens(item) > 0,
  )
  if (!message) return
  const model = providers.find((item) => item.id === message.providerID)?.models[message.modelID]
  if (!model || !Number.isFinite(model.limit.context) || model.limit.context <= 0) return
  const used = tokens(message)
  return { used, full: model.limit.context, leftPercent: clamp(100 - (used / model.limit.context) * 100), message }
}

export function creditsLabel(credits: { hasCredits: boolean; unlimited: boolean; balance?: string }) {
  if (!credits.hasCredits) return
  if (credits.unlimited) return "Unlimited"
  return credits.balance === undefined ? "Available" : `${credits.balance} credits`
}

export function hasUsageLimits(usage: {
  primary?: unknown
  secondary?: unknown
  credits?: { hasCredits: boolean }
  spend?: unknown
}) {
  return !!(usage.primary || usage.secondary || usage.credits?.hasCredits || usage.spend)
}

export function statusBodyHeight(height: number) {
  return Math.max(1, Math.floor(height * 0.75) - 4)
}

export function sessionTokens(messages: Message[], providerID: string) {
  return messages.reduce(
    (total, message) =>
      total + (message.role === "assistant" && message.providerID === providerID ? tokens(message) : 0),
    0,
  )
}

export function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`
  return Math.round(value).toString()
}

export function resetAt(value: number | undefined) {
  return value ? ` · resets ${new Date(value * 1000).toLocaleString()}` : ""
}
