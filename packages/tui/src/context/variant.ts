export function list(variants: Record<string, unknown> | undefined) {
  if (!variants) return []
  return Object.keys(variants)
}

export function cycle(variants: readonly string[], current: string | undefined) {
  if (!current) return variants[0]
  const index = variants.indexOf(current)
  if (index === -1 || index === variants.length - 1) return
  return variants[index + 1]
}
