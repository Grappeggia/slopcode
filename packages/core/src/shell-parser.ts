export * as ShellParser from "./shell-parser"

import { fileURLToPath } from "node:url"
import type { Node, Parser, Tree } from "web-tree-sitter"

export type { Node, Tree } from "web-tree-sitter"

export type Kind = "bash" | "powershell" | "cmd" | "unsupported"
export type Language = Exclude<Kind, "cmd" | "unsupported">
type Resource = { text: string; start: number; end: number }

export class SyntaxError extends Error {
  constructor(readonly shell: string) {
    super(`Could not parse command using the ${shell} grammar`)
    this.name = "ShellParser.SyntaxError"
  }
}

export class UnsupportedError extends Error {
  constructor(
    readonly shell: string,
    reason = "unsupported shell",
  ) {
    super(`Cannot safely authorize command for ${shell}: ${reason}`)
    this.name = "ShellParser.UnsupportedError"
  }
}

const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  return fileURLToPath(new URL(asset, import.meta.url))
}

const parser = (() => {
  let loading: Promise<Record<Language, Parser>> | undefined
  return () => {
    if (loading) return loading
    loading = (async () => {
      const { Parser, Language } = await import("web-tree-sitter")
      const { default: runtime } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
        with: { type: "wasm" },
      })
      await Parser.init({ locateFile: () => resolveWasm(runtime) })
      const [{ default: bashWasm }, { default: powershellWasm }] = await Promise.all([
        import("tree-sitter-bash/tree-sitter-bash.wasm" as string, { with: { type: "wasm" } }),
        import("tree-sitter-powershell/tree-sitter-powershell.wasm" as string, { with: { type: "wasm" } }),
      ])
      const [bashLanguage, powershellLanguage] = await Promise.all([
        Language.load(resolveWasm(bashWasm)),
        Language.load(resolveWasm(powershellWasm)),
      ])
      const bash = new Parser().setLanguage(bashLanguage)
      const powershell = new Parser().setLanguage(powershellLanguage)
      return { bash, powershell }
    })()
    return loading
  }
})()

const name = (shell: string) =>
  shell
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.replace(/\.exe$/i, "")
    .toLowerCase()
const POSIX = new Set(["ash", "bash", "dash", "ksh", "sh", "zsh"])

export function kind(shell: string): Kind {
  const base = name(shell)
  if (base === "powershell" || base === "pwsh") return "powershell"
  if (base === "cmd") return "cmd"
  if (base && POSIX.has(base)) return "bash"
  return "unsupported"
}

export async function parse(command: string, language: Language) {
  const tree = (await parser())[language].parse(command)
  if (!tree || tree.rootNode.hasError) {
    tree?.delete()
    throw new SyntaxError(language)
  }
  return tree
}

const item = (node: Node, source = node): Resource => ({
  text: source.text.trim(),
  start: source.startIndex,
  end: source.endIndex,
})

const unique = (items: Resource[]) => {
  const seen = new Set<string>()
  return items
    .toSorted((a, b) => a.start - b.start || b.end - a.end)
    .flatMap((entry) => {
      if (!entry.text || seen.has(entry.text)) return []
      seen.add(entry.text)
      return [entry.text]
    })
}

const descendants = (root: Node, types: string[]) =>
  root.descendantsOfType(types).filter((node): node is Node => node !== null)

const within = (node: Node, types: Set<string>) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (types.has(parent.type)) return true
  }
  return false
}

const bashResources = (tree: Tree) => {
  const atoms = new Set(["command", "declaration_command", "test_command", "unset_command", "variable_assignments"])
  const nodes = descendants(tree.rootNode, [...atoms, "variable_assignment"])
    .filter((node) => node.type !== "variable_assignment" || !within(node, atoms))
    .map((node) => {
      const parent = node.parent
      if (parent?.type !== "redirected_statement") return item(node)
      return parent.childForFieldName("body")?.id === node.id ? item(node, parent) : item(node)
    })
  const redirects = descendants(tree.rootNode, ["redirected_statement"]).flatMap((node) => {
    const body = node.childForFieldName("body")
    if (body && (atoms.has(body.type) || body.type === "variable_assignment")) return []
    return [item(node)]
  })
  const functions = descendants(tree.rootNode, ["function_definition"])
    .filter((node) => node.childForFieldName("redirect") !== null)
    .map((node) => item(node))
  return unique([...nodes, ...redirects, ...functions])
}

const scriptBlock = (node: Node) => {
  const name = node.childForFieldName("command_name")
  if (name?.type !== "command_name_expr") return false
  return descendants(name, ["script_block_expression"]).length > 0
}

const powershellResources = (tree: Tree) => {
  const commands = descendants(tree.rootNode, ["command", "data_command"])
    .filter((node) => node.type !== "command" || !scriptBlock(node))
    .map((node) => item(node))
  const expressions = descendants(tree.rootNode, ["pipeline_chain"])
    .filter((node) => !node.namedChildren.some((child) => child?.type === "command"))
    .map((node) => item(node))
  const assignments = descendants(tree.rootNode, ["assignment_expression"]).map((node) => item(node))
  const invocations = descendants(tree.rootNode, ["invokation_expression"]).map((node) => item(node))
  return unique([...commands, ...expressions, ...assignments, ...invocations])
}

const cmdResources = (command: string, shell: string) => {
  let quoted = false
  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    if (char === "%" || char === "!") throw new UnsupportedError(shell, "dynamic expansion is not supported")
    if (char === "\r" || char === "\n") throw new UnsupportedError(shell, "compound commands are not supported")
    if (char === "^") {
      if (command[i + 1] === "%" || command[i + 1] === "!")
        throw new UnsupportedError(shell, "dynamic expansion is not supported")
      i++
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === "|" || char === "(" || char === ")")
      throw new UnsupportedError(shell, "compound commands are not supported")
    if (char !== "&") continue
    const redirect = (command[i - 1] === ">" || command[i - 1] === "<") && /^[0-9-]$/.test(command[i + 1] ?? "")
    if (!redirect) throw new UnsupportedError(shell, "compound commands are not supported")
  }
  if (quoted) throw new SyntaxError(shell)
  return [command.trim()]
}

export async function resources(command: string, shell: string) {
  const family = kind(shell)
  if (family === "unsupported") throw new UnsupportedError(shell)
  if (family === "cmd") return cmdResources(command, shell)
  const tree = await parse(command, family)
  try {
    return family === "bash" ? bashResources(tree) : powershellResources(tree)
  } finally {
    tree.delete()
  }
}
