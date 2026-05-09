import z from "zod"
import { Tool } from "./tool"

const Recommendation = z.object({
  kind: z.enum([
    "test",
    "verify",
    "inspect",
    "commit",
    "pr",
    "release",
    "clarify",
    "switch_mode",
    "continue",
    "fix",
    "custom",
  ]),
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]).optional(),
  command: z.string().optional(),
  path: z.string().optional(),
  agent: z.string().optional(),
})

function uniq(list: z.infer<typeof Recommendation>[]) {
  const seen = new Set<string>()
  return list.filter((item) => {
    const key = JSON.stringify([item.kind, item.label, item.command ?? "", item.path ?? "", item.agent ?? ""])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function rank(priority?: string) {
  if (priority === "high") return 0
  if (priority === "medium") return 1
  if (priority === "low") return 2
  return 1
}

function render(list: z.infer<typeof Recommendation>[]) {
  return list
    .flatMap((item) => {
      const tail = [item.command ? `command: \`${item.command}\`` : "", item.path ? `path: \`${item.path}\`` : "", item.agent ? `agent: @${item.agent}` : ""]
        .filter(Boolean)
        .join(" • ")
      return [`- ${item.label}${tail ? ` (${tail})` : ""}`, `  ${item.reason}`]
    })
    .join("\n")
}

export const FollowupRecommendationsTool = Tool.define("followup_recommendations", {
  description:
    "Use this near the end of your turn to predict the most helpful concrete next actions for the user. Keep it specific, concise, and limited to a few high-signal recommendations.",
  parameters: z.object({
    recommendations: Recommendation.array().min(1).max(5),
  }),
  async execute(params) {
    const recommendations = uniq(params.recommendations)
      .map((item) => ({ ...item, priority: item.priority ?? "medium" }))
      .toSorted((a, b) => rank(a.priority) - rank(b.priority))
      .slice(0, 5)

    return {
      title: `Suggested next action${recommendations.length === 1 ? "" : "s"}`,
      output: render(recommendations),
      metadata: {
        recommendations,
      },
    }
  },
})
