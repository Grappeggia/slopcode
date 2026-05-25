export function forkTabs(input: { all?: string[]; active?: string }) {
  const all = (input.all ?? []).filter((tab) => tab !== "review")
  const active = input.active && all.includes(input.active) ? input.active : all[0]
  return { all, active }
}
