import z from "zod"

const WorktreeConfig = z.object({
  directory: z.string(),
  type: z.literal("worktree"),
})

const CustomConfig = z
  .object({
    type: z.string().refine((value) => value !== "worktree"),
  })
  .passthrough()

export const Config = z.union([WorktreeConfig, CustomConfig])

export type Config = z.infer<typeof Config>
