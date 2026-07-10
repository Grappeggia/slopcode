import type { UsageInfo } from "./provider/provider"
import type { Cost } from "./reservation"

export function calculateUsageCost(cost: Cost, cost200K: Cost | undefined, usage: UsageInfo) {
  const model =
    cost200K &&
    usage.inputTokens +
      (usage.cacheReadTokens ?? 0) +
      (usage.cacheWrite5mTokens ?? 0) +
      (usage.cacheWrite1hTokens ?? 0) >
      200_000
      ? cost200K
      : cost
  const inputCost = model.input * usage.inputTokens * 100
  const outputCost = model.output * (usage.outputTokens + (usage.reasoningTokens ?? 0)) * 100
  const cacheReadCost =
    usage.cacheReadTokens && model.cacheRead ? model.cacheRead * usage.cacheReadTokens * 100 : undefined
  const cacheWrite5mCost =
    usage.cacheWrite5mTokens && model.cacheWrite5m ? model.cacheWrite5m * usage.cacheWrite5mTokens * 100 : undefined
  const cacheWrite1hCost =
    usage.cacheWrite1hTokens && model.cacheWrite1h ? model.cacheWrite1h * usage.cacheWrite1hTokens * 100 : undefined
  return {
    totalCostInCent: inputCost + outputCost + (cacheReadCost ?? 0) + (cacheWrite5mCost ?? 0) + (cacheWrite1hCost ?? 0),
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWrite5mCost,
    cacheWrite1hCost,
  }
}
