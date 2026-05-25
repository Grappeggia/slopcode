const marker = {
  BASH: "bash",
  JS: "javascript",
  JSX: "javascriptreact",
  JSON: "json",
  JSONC: "jsonc",
  MD: "markdown",
  PY: "python",
  PYTHON: "python",
  RB: "ruby",
  SH: "bash",
  SQL: "sql",
  TS: "typescript",
  TSX: "typescriptreact",
  XML: "xml",
  YAML: "yaml",
  YML: "yaml",
} as const satisfies Record<string, string>

export function normalizeLanguage(input?: string) {
  if (!input) return
  const value = input.trim().toLowerCase()
  if (!value) return
  if (["bash", "shell", "shellscript", "sh", "zsh"].includes(value)) return "bash"
  if (["py", "python", "python3"].includes(value)) return "python"
  if (["js", "node", "nodejs", "javascript"].includes(value)) return "javascript"
  if (["jsx", "javascriptreact"].includes(value)) return "javascriptreact"
  if (["ts", "typescript"].includes(value)) return "typescript"
  if (["tsx", "typescriptreact"].includes(value)) return "typescriptreact"
  if (["md", "markdown"].includes(value)) return "markdown"
  if (["rb", "ruby"].includes(value)) return "ruby"
  if (["yml", "yaml"].includes(value)) return "yaml"
  return value
}

export function inferInterpreterLanguage(line: string) {
  const command = line
    .replace(/^\$\s*/, "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
  if (!command) return
  return normalizeLanguage(command)
}

export function inferMarkerLanguage(value: string) {
  const key = value.trim().replace(/['"]/g, "").toUpperCase()
  if (!key) return
  const known = marker[key as keyof typeof marker]
  if (known) return known
  return normalizeLanguage(key)
}

export function resolveCodeLanguage(input?: string) {
  const value = normalizeLanguage(input)
  if (!value) return "text"
  return value
}
