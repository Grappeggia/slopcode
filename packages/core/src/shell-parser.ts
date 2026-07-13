export * as ShellParser from "./shell-parser"

import { fileURLToPath } from "node:url"
import type { Node, Parser, Tree } from "web-tree-sitter"

export type { Node, Tree } from "web-tree-sitter"

export type Kind = "bash" | "posix" | "powershell" | "cmd" | "unsupported"
export type Language = Extract<Kind, "bash" | "powershell">
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
const POSIX = new Set(["ash", "dash", "ksh", "sh", "zsh"])

export function kind(shell: string): Kind {
  const base = name(shell)
  if (base === "powershell" || base === "pwsh") return "powershell"
  if (base === "cmd") return "cmd"
  if (base === "bash") return "bash"
  if (base && POSIX.has(base)) return "posix"
  return "unsupported"
}

// Hex stays byte-exact even when saved wildcard patterns are matched case-insensitively.
const encode = (value: string) => Buffer.from(value, "utf8").toString("hex")

export function opaque(shell: string, command: string) {
  return `[opaque shell statement] shell-utf8=${encode(shell)} source-utf8=${encode(command)}`
}

const powershellInput = (command: string) => {
  // The grammar cannot parse variables concatenated with path suffixes. Same-length
  // placeholders preserve offsets so authorization still reads the original source.
  return command.replace(/\$(?:env:[A-Za-z_][A-Za-z0-9_]*|\{env:[^}\r\n]+\})(?=[\\/])/gi, (value) =>
    "x".repeat(value.length),
  )
}

export async function parse(command: string, language: Language) {
  const syntax = (await parser())[language]
  const tree = syntax.parse(command)
  if (tree && !tree.rootNode.hasError) return tree
  if (language === "powershell") {
    const input = powershellInput(command)
    if (input !== command) {
      const fallback = syntax.parse(input)
      if (fallback && !fallback.rootNode.hasError) {
        tree?.delete()
        return fallback
      }
      fallback?.delete()
    }
  }
  tree?.delete()
  throw new SyntaxError(language)
}

const item = (command: string, node: Node, source = node): Resource => ({
  text: command.slice(source.startIndex, source.endIndex).trim(),
  start: source.startIndex,
  end: source.endIndex,
})

const through = (command: string, node: Node, end: Node): Resource => ({
  text: command.slice(node.startIndex, end.endIndex).trim(),
  start: node.startIndex,
  end: end.endIndex,
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

const bashResources = (tree: Tree, command: string) => {
  const atoms = new Set(["command", "declaration_command", "test_command", "unset_command", "variable_assignments"])
  const nodes = descendants(tree.rootNode, [...atoms, "variable_assignment"])
    .filter((node) => node.type !== "variable_assignment" || !within(node, atoms))
    .map((node) => {
      const parent = node.parent
      if (parent?.type !== "redirected_statement") return item(command, node)
      return parent.childForFieldName("body")?.id === node.id ? item(command, node, parent) : item(command, node)
    })
  const redirects = descendants(tree.rootNode, ["redirected_statement"]).flatMap((node) => {
    const body = node.childForFieldName("body")
    if (body && (atoms.has(body.type) || body.type === "variable_assignment")) return []
    return [item(command, node)]
  })
  const functions = descendants(tree.rootNode, ["function_definition"])
    .filter((node) => node.childForFieldName("redirect") !== null)
    .map((node) => item(command, node))
  return unique([...nodes, ...redirects, ...functions])
}

const scriptBlock = (node: Node) => {
  const name = node.childForFieldName("command_name")
  if (name?.type !== "command_name_expr") return false
  return descendants(name, ["script_block_expression"]).length > 0
}

const redirected = (node: Node) =>
  node.childForFieldName("command_elements")?.namedChildren.some((child) => child?.type === "redirection") ?? false

const powershellResources = (tree: Tree, command: string) => {
  const commands = descendants(tree.rootNode, ["command", "data_command"])
    .filter((node) => node.type !== "command" || !scriptBlock(node) || redirected(node))
    .map((node) => item(command, node))
  const expressions = descendants(tree.rootNode, ["pipeline_chain"]).flatMap((node) => {
    const children = node.namedChildren.filter((child): child is Node => child !== null)
    const first = children[0]
    if (!first || first.type === "command") return []
    const redirects = children.find((child) => child.type === "redirections")
    return [redirects ? through(command, node, redirects) : item(command, first)]
  })
  const assignments = descendants(tree.rootNode, ["assignment_expression"]).map((node) => item(command, node))
  const invocations = descendants(tree.rootNode, ["invokation_expression"]).map((node) => item(command, node))
  return unique([...commands, ...expressions, ...assignments, ...invocations])
}

const posixResources = (command: string, shell: string) => {
  let quote: "single" | "double" | undefined
  let unsafe = false
  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    if (quote === "single") {
      if (char === "'") quote = undefined
      continue
    }
    if (quote === "double") {
      if (char === '"') {
        quote = undefined
        continue
      }
      if (char === "$" || char === "`") unsafe = true
      if (char !== "\\") continue
      if (["$", "`", '"', "\\", "\n"].includes(command[i + 1] ?? "")) i++
      continue
    }
    if (char === "'") {
      quote = "single"
      continue
    }
    if (char === '"') {
      quote = "double"
      continue
    }
    if (char === "\\") {
      if (command[i + 1] === undefined) throw new SyntaxError(shell)
      i++
      continue
    }
    if (char === "$" || char === "`" || ";&|<>(){}\r\n".includes(char)) unsafe = true
  }
  if (quote) throw new SyntaxError(shell)
  const source = command.trim()
  if (!source || source.startsWith("#") || unsafe) return [opaque(shell, command)]
  return [source]
}

const cmdResources = (command: string, shell: string) => {
  let quoted = false
  let unsafe = false
  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    if (char === "%" || char === "!" || char === "\r" || char === "\n") unsafe = true
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === "^") {
      if (command[i + 1] === undefined) {
        unsafe = true
        continue
      }
      if (command[i + 1] === "%" || command[i + 1] === "!" || command[i + 1] === "\r" || command[i + 1] === "\n")
        unsafe = true
      i++
      continue
    }
    if (char === "|" || char === "(" || char === ")") unsafe = true
    if (char !== "&") continue
    const redirect = (command[i - 1] === ">" || command[i - 1] === "<") && /^[0-9-]$/.test(command[i + 1] ?? "")
    if (!redirect) unsafe = true
  }
  if (quoted) throw new SyntaxError(shell)
  const source = command.trim()
  if (!source || unsafe) return [opaque(shell, command)]
  return [source]
}

export async function resources(command: string, shell: string) {
  const family = kind(shell)
  if (family === "unsupported") throw new UnsupportedError(shell)
  if (family === "cmd") return cmdResources(command, shell)
  if (family === "posix") return posixResources(command, shell)
  const tree = await parse(command, family)
  try {
    const result = family === "bash" ? bashResources(tree, command) : powershellResources(tree, command)
    return result.length ? result : [opaque(shell, command)]
  } finally {
    tree.delete()
  }
}
