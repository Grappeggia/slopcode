import { basename } from "node:path"

const safeId = "[A-Za-z0-9._-]+"
const rendererStorePattern = new RegExp(
  `^(?:default\\.dat|slopcode\\.global\\.dat|slopcode\\.(?:workspace|draft)\\.${safeId}\\.dat)$`,
)

export function isRendererStoreName(value: unknown): value is string {
  return typeof value === "string" && value.length <= 255 && basename(value) === value && rendererStorePattern.test(value)
}

export function assertRendererStoreName(value: unknown) {
  if (!isRendererStoreName(value)) throw new Error("Invalid renderer store name")
  return value
}
