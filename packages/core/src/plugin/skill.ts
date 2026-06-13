/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { Effect } from "effect"
import { PluginV2 } from "../plugin"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeSlopcodeContent from "./skill/customize-slopcode.md" with { type: "text" }

export const CustomizeSlopcodeContent = customizeSlopcodeContent

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("skill"),
  effect: Effect.gen(function* () {
    const skill = yield* SkillV2.Service
    const transform = yield* skill.transform()

    yield* transform((editor) => {
      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "customize-slopcode",
            description:
              "Use ONLY when the user is editing or creating slopcode's own configuration: slopcode.json, slopcode.jsonc, files under .slopcode/, or files under ~/.config/slopcode/. Also use when creating or fixing slopcode agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring slopcode itself.",
            location: AbsolutePath.make("/builtin/customize-slopcode.md"),
            content: CustomizeSlopcodeContent,
          }),
        }),
      )
    })
  }),
})
