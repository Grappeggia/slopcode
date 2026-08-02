export const product = {
  id: "slopcode",
  // Legacy SlopCode identifiers are read-compat only.
  // New writes should always use SlopCode identifiers.
  legacy_id: "slopcode",
  app: "SlopCode",
  legacy_app: "SlopCode",
  package: "slopcode",
  config: {
    schema: "https://slopcode.dev/config.json",
    well_known: ".well-known/slopcode",
    dirs: [".slopcode", ".slopcode"],
    names: ["slopcode", "slopcode"],
    global_files: ["slopcode.jsonc", "slopcode.json", "config.json", "slopcode.jsonc", "slopcode.json"],
  },
  deep_link: {
    schemes: ["slopcode://", "slopcode://"],
  },
  share: {
    default_url: "https://slopcode.dev",
    dev_url: "https://dev.slopcode.dev",
  },
  github: {
    owner: "teamslop",
    repo: "slopcode",
    full_repo: "teamslop/slopcode",
    app: "slopcode-agent",
    app_user: "slopcode-agent[bot]",
    workflow_file: ".github/workflows/slopcode.yml",
  },
  urls: {
    site: "https://slopcode.dev",
    auth: "https://slopcode.dev/auth",
    zen: "https://slopcode.dev/zen",
    docs: "https://slopcode.dev/docs",
    discord: "https://slopcode.dev/discord",
    install: "https://slopcode.dev/install",
    api: "https://api.slopcode.dev",
    github: "https://github.com/teamslop/slopcode",
    github_app: "https://github.com/apps/slopcode-agent",
  },
} as const

export function configNames(name: string) {
  if (name === product.id) return [...product.config.names]
  return [name]
}
