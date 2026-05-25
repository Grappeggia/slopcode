import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./repo_clone.txt"
import { parseRemoteRepositoryReference, repositoryCachePath, validateRepositoryBranch } from "@/util/repository"
import { RepositoryCache } from "@/reference/repository-cache"

const parameters = z.object({
  repository: z
    .string()
    .describe("Repository to clone, as a git URL, host/path reference, or GitHub owner/repo shorthand"),
  refresh: z.boolean().describe("When true, fetches the latest remote state into the managed cache").optional(),
  branch: z.string().describe("Branch or ref to clone and inspect").optional(),
})

export const RepoCloneTool = Tool.define("repo_clone", {
  description: DESCRIPTION,
  parameters,
  async execute(params, ctx) {
    const reference = parseRemoteRepositoryReference(params.repository)
    if (params.branch) validateRepositoryBranch(params.branch)

    const repository = reference.label
    const localPath = repositoryCachePath(reference)

    await ctx.ask({
      permission: "repo_clone",
      patterns: [repository],
      always: [repository],
      metadata: {
        repository,
        remote: reference.remote,
        path: localPath,
        refresh: Boolean(params.refresh),
        branch: params.branch,
      },
    })

    const result = await RepositoryCache.ensure({ reference, refresh: params.refresh, branch: params.branch })
    return {
      title: repository,
      metadata: result,
      output: [
        `Repository ready: ${repository}`,
        `Status: ${result.status}`,
        `Local path: ${localPath}`,
        ...(result.branch ? [`Branch: ${result.branch}`] : []),
        ...(result.head ? [`HEAD: ${result.head}`] : []),
      ].join("\n"),
    }
  },
})
