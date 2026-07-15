import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["SLOPCODE_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("SLOPCODE_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  SLOPCODE_AUTO_HEAP_SNAPSHOT: truthy("SLOPCODE_AUTO_HEAP_SNAPSHOT"),
  SLOPCODE_GIT_BASH_PATH: process.env["SLOPCODE_GIT_BASH_PATH"],
  SLOPCODE_CONFIG: process.env["SLOPCODE_CONFIG"],
  SLOPCODE_CONFIG_CONTENT: process.env["SLOPCODE_CONFIG_CONTENT"],
  SLOPCODE_DISABLE_AUTOUPDATE: truthy("SLOPCODE_DISABLE_AUTOUPDATE"),
  SLOPCODE_ALWAYS_NOTIFY_UPDATE: truthy("SLOPCODE_ALWAYS_NOTIFY_UPDATE"),
  SLOPCODE_DISABLE_PRUNE: truthy("SLOPCODE_DISABLE_PRUNE"),
  SLOPCODE_DISABLE_TERMINAL_TITLE: truthy("SLOPCODE_DISABLE_TERMINAL_TITLE"),
  SLOPCODE_SHOW_TTFD: truthy("SLOPCODE_SHOW_TTFD"),
  SLOPCODE_DISABLE_AUTOCOMPACT: truthy("SLOPCODE_DISABLE_AUTOCOMPACT"),
  SLOPCODE_DISABLE_MODELS_FETCH: truthy("SLOPCODE_DISABLE_MODELS_FETCH"),
  SLOPCODE_DISABLE_MOUSE: truthy("SLOPCODE_DISABLE_MOUSE"),
  SLOPCODE_FAKE_VCS: process.env["SLOPCODE_FAKE_VCS"],
  SLOPCODE_SERVER_PASSWORD: process.env["SLOPCODE_SERVER_PASSWORD"],
  SLOPCODE_SERVER_USERNAME: process.env["SLOPCODE_SERVER_USERNAME"],
  SLOPCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("SLOPCODE_DISABLE_FFF"),

  // Experimental
  SLOPCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("SLOPCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  SLOPCODE_MODELS_URL: process.env["SLOPCODE_MODELS_URL"],
  SLOPCODE_MODELS_PATH: process.env["SLOPCODE_MODELS_PATH"],
  SLOPCODE_DB: process.env["SLOPCODE_DB"],

  SLOPCODE_WORKSPACE_ID: process.env["SLOPCODE_WORKSPACE_ID"],
  SLOPCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("SLOPCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get SLOPCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("SLOPCODE_DISABLE_PROJECT_CONFIG")
  },
  get SLOPCODE_DISABLE_AUTOCOMPLETE() {
    return truthy("SLOPCODE_DISABLE_AUTOCOMPLETE")
  },
  get SLOPCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("SLOPCODE_EXPERIMENTAL_REFERENCES")
  },
  get SLOPCODE_EXPERIMENTAL_OXFMT() {
    return enabledByExperimental("SLOPCODE_EXPERIMENTAL_OXFMT")
  },
  get SLOPCODE_TUI_CONFIG() {
    return process.env["SLOPCODE_TUI_CONFIG"]
  },
  get SLOPCODE_CONFIG_DIR() {
    return process.env["SLOPCODE_CONFIG_DIR"]
  },
  get SLOPCODE_PURE() {
    return truthy("SLOPCODE_PURE")
  },
  get SLOPCODE_PERMISSION() {
    return process.env["SLOPCODE_PERMISSION"]
  },
  get SLOPCODE_PLUGIN_META_FILE() {
    return process.env["SLOPCODE_PLUGIN_META_FILE"]
  },
  get SLOPCODE_CLIENT() {
    return process.env["SLOPCODE_CLIENT"] ?? "cli"
  },
}
