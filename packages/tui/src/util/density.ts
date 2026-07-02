export type Density = "comfortable" | "compact" | "dense"

export function density(size: { width: number; height: number }): Density {
  if (size.width < 70 || size.height < 18) return "dense"
  if (size.width < 90 || size.height < 24) return "compact"
  return "comfortable"
}

export function isCompact(value: Density) {
  return value !== "comfortable"
}

export function isDense(value: Density) {
  return value === "dense"
}
