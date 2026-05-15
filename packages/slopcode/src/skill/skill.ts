import z from "zod"
import path from "path"
import os from "os"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { NamedError } from "@slopcode-ai/util/error"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@/flag/flag"
import { Bus } from "@/bus"
import { Session } from "@/session"
import { Discovery } from "./discovery"
import { Glob } from "../util/glob"

export namespace Skill {
  const log = Log.create({ service: "skill" })
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    content: z.string(),
  })
  export type Info = z.infer<typeof Info>

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  )

  // External skill directories to search for (project-level and global)
  // These follow the directory layout used by Claude Code and other agents.
  const EXTERNAL_DIRS = [".claude", ".agents"]
  const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  const SLOPCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
  const SKILL_PATTERN = "**/SKILL.md"
  const CUSTOMIZE_SLOPCODE_SKILL_NAME = "customize-slopcode"
  const CUSTOMIZE_SLOPCODE_SKILL_DESCRIPTION =
    "Use ONLY when the user is editing or creating SlopCode configuration: slopcode.json, slopcode.jsonc, files under .slopcode/, or files under ~/.config/slopcode/. Also use when creating or fixing SlopCode agents, subagents, skills, plugins, MCP servers, reference repositories, or permission rules."
  const CUSTOMIZE_SLOPCODE_SKILL_BODY = `# Customizing SlopCode

SlopCode validates its own config strictly and refuses to start when a field is wrong. Treat the published schema as the source of truth:

https://slopcode.dev/config.json

Every SlopCode config should declare:

\`\`\`json
{ "$schema": "https://slopcode.dev/config.json" }
\`\`\`

Common config locations:
- Project config: \`./slopcode.json\`, \`./slopcode.jsonc\`, or \`.slopcode/slopcode.json\`
- Global config: \`~/.config/slopcode/slopcode.json\`
- Project agents: \`.slopcode/agent/<name>.md\` or \`.slopcode/agents/<name>.md\`
- Global agents: \`~/.config/slopcode/agent(s)/<name>.md\`
- Project skills: \`.slopcode/skill(s)/<name>/SKILL.md\`
- Global skills: \`~/.config/slopcode/skill(s)/<name>/SKILL.md\`

Configs are deep-merged. Project overrides global. Unknown top-level keys are rejected.

Useful fields include \`model\`, \`small_model\`, \`default_agent\`, \`agent\`, \`command\`, \`provider\`, \`mcp\`, \`plugin\`, \`permission\`, \`reference\`, \`attachment\`, and \`experimental\`.

After changing config-time files, tell the user to restart SlopCode so the new config is loaded.
`

  function builtin(): Info {
    return {
      name: CUSTOMIZE_SLOPCODE_SKILL_NAME,
      description: CUSTOMIZE_SLOPCODE_SKILL_DESCRIPTION,
      location: "builtin://customize-slopcode",
      content: CUSTOMIZE_SLOPCODE_SKILL_BODY,
    }
  }

  export const state = Instance.state(async () => {
    const skills: Record<string, Info> = {}
    const dirs = new Set<string>()

    const addSkill = async (match: string) => {
      const md = await ConfigMarkdown.parse(match).catch((err) => {
        const message = ConfigMarkdown.FrontmatterError.isInstance(err)
          ? err.data.message
          : `Failed to parse skill ${match}`
        Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to load skill", { skill: match, err })
        return undefined
      })

      if (!md) return

      const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
      if (!parsed.success) return

      // Warn on duplicate skill names
      if (skills[parsed.data.name]) {
        log.warn("duplicate skill name", {
          name: parsed.data.name,
          existing: skills[parsed.data.name].location,
          duplicate: match,
        })
      }

      dirs.add(path.dirname(match))

      skills[parsed.data.name] = {
        name: parsed.data.name,
        description: parsed.data.description,
        location: match,
        content: md.content,
      }
    }

    const scanExternal = async (root: string, scope: "global" | "project") => {
      return Glob.scan(EXTERNAL_SKILL_PATTERN, {
        cwd: root,
        absolute: true,
        include: "file",
        dot: true,
        symlink: true,
      })
        .then((matches) => Promise.all(matches.map(addSkill)))
        .catch((error) => {
          log.error(`failed to scan ${scope} skills`, { dir: root, error })
        })
    }

    // Scan external skill directories (.claude/skills/, .agents/skills/, etc.)
    // Load global (home) first, then project-level (so project-level overwrites)
    if (!Flag.SLOPCODE_DISABLE_EXTERNAL_SKILLS) {
      for (const dir of EXTERNAL_DIRS) {
        const root = path.join(Global.Path.home, dir)
        if (!(await Filesystem.isDir(root))) continue
        await scanExternal(root, "global")
      }

      for await (const root of Filesystem.up({
        targets: EXTERNAL_DIRS,
        start: Instance.directory,
        stop: Instance.worktree,
      })) {
        await scanExternal(root, "project")
      }
    }

    // Scan .slopcode/skill/ directories
    for (const dir of await Config.directories()) {
      const matches = await Glob.scan(SLOPCODE_SKILL_PATTERN, {
        cwd: dir,
        absolute: true,
        include: "file",
        symlink: true,
      })
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Scan additional skill paths from config
    const config = await Config.get()
    for (const skillPath of config.skills?.paths ?? []) {
      const expanded = skillPath.startsWith("~/") ? path.join(os.homedir(), skillPath.slice(2)) : skillPath
      const resolved = path.isAbsolute(expanded) ? expanded : path.join(Instance.directory, expanded)
      if (!(await Filesystem.isDir(resolved))) {
        log.warn("skill path not found", { path: resolved })
        continue
      }
      const matches = await Glob.scan(SKILL_PATTERN, {
        cwd: resolved,
        absolute: true,
        include: "file",
        symlink: true,
      })
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Download and load skills from URLs
    for (const url of config.skills?.urls ?? []) {
      const list = await Discovery.pull(url)
      for (const dir of list) {
        dirs.add(dir)
        const matches = await Glob.scan(SKILL_PATTERN, {
          cwd: dir,
          absolute: true,
          include: "file",
          symlink: true,
        })
        for (const match of matches) {
          await addSkill(match)
        }
      }
    }

    return {
      skills,
      dirs: Array.from(dirs),
    }
  })

  export async function get(name: string) {
    if (name === CUSTOMIZE_SLOPCODE_SKILL_NAME) return builtin()
    return state().then((x) => x.skills[name])
  }

  export async function all(options?: { builtin?: boolean }) {
    const skills = await state().then((x) => Object.values(x.skills))
    if (!options?.builtin) return skills
    return [builtin(), ...skills]
  }

  export async function dirs() {
    return state().then((x) => x.dirs)
  }
}
