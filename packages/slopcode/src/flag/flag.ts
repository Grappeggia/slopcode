function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

export namespace Flag {
  export const SLOPCODE_AUTO_SHARE = truthy("SLOPCODE_AUTO_SHARE")
  export const SLOPCODE_GIT_BASH_PATH = process.env["SLOPCODE_GIT_BASH_PATH"]
  export const SLOPCODE_CONFIG = process.env["SLOPCODE_CONFIG"]
  export declare const SLOPCODE_TUI_CONFIG: string | undefined
  export declare const SLOPCODE_CONFIG_DIR: string | undefined
  export const SLOPCODE_CONFIG_CONTENT = process.env["SLOPCODE_CONFIG_CONTENT"]
  export const SLOPCODE_DISABLE_AUTOUPDATE = truthy("SLOPCODE_DISABLE_AUTOUPDATE")
  export const SLOPCODE_DISABLE_PRUNE = truthy("SLOPCODE_DISABLE_PRUNE")
  export const SLOPCODE_DISABLE_MOUSE = truthy("SLOPCODE_DISABLE_MOUSE")
  export const SLOPCODE_DISABLE_TERMINAL_TITLE = truthy("SLOPCODE_DISABLE_TERMINAL_TITLE")
  export const SLOPCODE_PERMISSION = process.env["SLOPCODE_PERMISSION"]
  export const SLOPCODE_PURE = truthy("SLOPCODE_PURE")
  export const SLOPCODE_DISABLE_DEFAULT_PLUGINS = truthy("SLOPCODE_DISABLE_DEFAULT_PLUGINS")
  export const SLOPCODE_DISABLE_LSP_DOWNLOAD = truthy("SLOPCODE_DISABLE_LSP_DOWNLOAD")
  export const SLOPCODE_ENABLE_EXPERIMENTAL_MODELS = truthy("SLOPCODE_ENABLE_EXPERIMENTAL_MODELS")
  export const SLOPCODE_DISABLE_AUTOCOMPACT = truthy("SLOPCODE_DISABLE_AUTOCOMPACT")
  export const SLOPCODE_DISABLE_MODELS_FETCH = truthy("SLOPCODE_DISABLE_MODELS_FETCH")
  export const SLOPCODE_DISABLE_CLAUDE_CODE = truthy("SLOPCODE_DISABLE_CLAUDE_CODE")
  export const SLOPCODE_DISABLE_CLAUDE_CODE_PROMPT =
    SLOPCODE_DISABLE_CLAUDE_CODE || truthy("SLOPCODE_DISABLE_CLAUDE_CODE_PROMPT")
  export const SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS =
    SLOPCODE_DISABLE_CLAUDE_CODE || truthy("SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS")
  export const SLOPCODE_DISABLE_EXTERNAL_SKILLS =
    SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS || truthy("SLOPCODE_DISABLE_EXTERNAL_SKILLS")
  export declare const SLOPCODE_DISABLE_PROJECT_CONFIG: boolean
  export const SLOPCODE_FAKE_VCS = process.env["SLOPCODE_FAKE_VCS"]
  export declare const SLOPCODE_CLIENT: string
  export declare const SLOPCODE_SERVER_PASSWORD: string | undefined
  export declare const SLOPCODE_SERVER_USERNAME: string | undefined
  export const SLOPCODE_ENABLE_QUESTION_TOOL = truthy("SLOPCODE_ENABLE_QUESTION_TOOL")

  // Experimental
  export const SLOPCODE_EXPERIMENTAL = truthy("SLOPCODE_EXPERIMENTAL")
  export const SLOPCODE_EXPERIMENTAL_CONSOLE = SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_CONSOLE")
  export const SLOPCODE_EXPERIMENTAL_PROVIDERS = SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_PROVIDERS")
  export const SLOPCODE_EXPERIMENTAL_FILEWATCHER = truthy("SLOPCODE_EXPERIMENTAL_FILEWATCHER")
  export const SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const SLOPCODE_EXPERIMENTAL_ICON_DISCOVERY =
    SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const SLOPCODE_ENABLE_EXA =
    truthy("SLOPCODE_ENABLE_EXA") || SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_EXA")
  export const SLOPCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("SLOPCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const SLOPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("SLOPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const SLOPCODE_EXPERIMENTAL_OXFMT = SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_OXFMT")
  export const SLOPCODE_EXPERIMENTAL_LSP_TY = truthy("SLOPCODE_EXPERIMENTAL_LSP_TY")
  export const SLOPCODE_EXPERIMENTAL_LSP_TOOL = SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_LSP_TOOL")
  export const SLOPCODE_DISABLE_FILETIME_CHECK = truthy("SLOPCODE_DISABLE_FILETIME_CHECK")
  export const SLOPCODE_EXPERIMENTAL_PLAN_MODE = SLOPCODE_EXPERIMENTAL || truthy("SLOPCODE_EXPERIMENTAL_PLAN_MODE")
  export const SLOPCODE_EXPERIMENTAL_MARKDOWN = truthy("SLOPCODE_EXPERIMENTAL_MARKDOWN")
  export declare const SLOPCODE_MODELS_URL: string | undefined
  export declare const SLOPCODE_MODELS_PATH: string | undefined

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for SLOPCODE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "SLOPCODE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("SLOPCODE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for SLOPCODE_TUI_CONFIG
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "SLOPCODE_TUI_CONFIG", {
  get() {
    return process.env["SLOPCODE_TUI_CONFIG"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for SLOPCODE_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "SLOPCODE_CONFIG_DIR", {
  get() {
    return process.env["SLOPCODE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for SLOPCODE_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "SLOPCODE_CLIENT", {
  get() {
    return process.env["SLOPCODE_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "SLOPCODE_SERVER_PASSWORD", {
  get() {
    return process.env["SLOPCODE_SERVER_PASSWORD"]
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "SLOPCODE_SERVER_USERNAME", {
  get() {
    return process.env["SLOPCODE_SERVER_USERNAME"]
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "SLOPCODE_MODELS_URL", {
  get() {
    return process.env["SLOPCODE_MODELS_URL"]
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "SLOPCODE_MODELS_PATH", {
  get() {
    return process.env["SLOPCODE_MODELS_PATH"]
  },
  enumerable: true,
  configurable: false,
})
