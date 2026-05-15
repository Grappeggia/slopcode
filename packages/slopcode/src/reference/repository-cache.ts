import fs from "fs/promises"
import path from "path"
import { repositoryCachePath, type Reference } from "@/util/repository"
import { Global } from "@/global"

async function exists(target: string) {
  return fs.stat(target).then(() => true).catch(() => false)
}

async function run(args: string[], cwd?: string) {
  const proc = Bun.spawn(args, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) throw new Error(stderr.trim() || stdout.trim() || `${args[0]} failed with exit code ${code}`)
  return stdout.trim()
}

export namespace RepositoryCache {
  export async function ensure(input: { reference: Reference; refresh?: boolean; branch?: string }) {
    const localPath = repositoryCachePath(input.reference)
    await fs.mkdir(Global.Path.repos, { recursive: true })

    const gitDir = path.join(localPath, ".git")
    const existsGit = await exists(gitDir)
    if (!existsGit) {
      const args = ["git", "clone", "--depth", "1"]
      if (input.branch) args.push("--branch", input.branch)
      args.push(input.reference.remote, localPath)
      await run(args)
      return {
        repository: input.reference.label,
        host: input.reference.label.split("/")[0] ?? "",
        remote: input.reference.remote,
        localPath,
        status: "cloned" as const,
        head: await run(["git", "rev-parse", "HEAD"], localPath).catch(() => undefined),
        branch: await run(["git", "branch", "--show-current"], localPath).catch(() => input.branch),
      }
    }

    if (input.refresh) {
      await run(["git", "fetch", "--depth", "1", "origin", input.branch ?? "HEAD"], localPath).catch(() =>
        run(["git", "fetch", "--depth", "1"], localPath),
      )
      if (input.branch) await run(["git", "checkout", input.branch], localPath)
    }

    return {
      repository: input.reference.label,
      host: input.reference.label.split("/")[0] ?? "",
      remote: input.reference.remote,
      localPath,
      status: input.refresh ? ("refreshed" as const) : ("cached" as const),
      head: await run(["git", "rev-parse", "HEAD"], localPath).catch(() => undefined),
      branch: await run(["git", "branch", "--show-current"], localPath).catch(() => input.branch),
    }
  }
}
