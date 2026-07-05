import { beforeEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { FileSystem } from "@slopcode-ai/core/filesystem"
import { LocationSearch } from "@slopcode-ai/core/location-search"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { AbsolutePath, RelativePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { GlobTool } from "@slopcode-ai/core/tool/glob"
import { GrepTool } from "@slopcode-ai/core/tool/grep"
import { testEffect } from "./lib/effect"
import { settleTool, toolIdentity } from "./lib/tool"

const assertions: PermissionV2.AssertInput[] = []
const roots: FileSystem.ListInput[] = []
const fileSearches: LocationSearch.FilesInput[] = []
const grepSearches: LocationSearch.GrepInput[] = []

const permission = Layer.succeed(
  PermissionV2.Service,
  PermissionV2.Service.of({
    assert: (input) =>
      Effect.sync(() => {
        assertions.push(input)
      }),
    ask: () => Effect.die("unused"),
    reply: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    forSession: () => Effect.die("unused"),
    list: () => Effect.die("unused"),
  }),
)

const filesystem = Layer.succeed(
  FileSystem.Service,
  FileSystem.Service.of({
    read: () => Effect.die("unused"),
    resolveReadPath: () => Effect.die("unused"),
    resolveRoot: (input = {}) =>
      Effect.sync(() => {
        roots.push(input)
        return new FileSystem.RootTarget({
          real: AbsolutePath.make("/tmp/slopcode/src"),
          root: AbsolutePath.make("/tmp/slopcode"),
          resource: input.reference === undefined ? (input.path ?? ".") : `${input.reference}:${input.path ?? "."}`,
          reference: input.reference,
          type: "directory",
        })
      }),
    list: () => Effect.die("unused"),
    find: () => Effect.die("unused"),
    glob: () => Effect.die("unused"),
    grep: () => Effect.die("unused"),
  }),
)

const search = Layer.succeed(
  LocationSearch.Service,
  LocationSearch.Service.of({
    files: (input) =>
      Effect.sync(() => {
        fileSearches.push(input)
        return new LocationSearch.FilesResult({
          items: [
            new LocationSearch.File({
              path: RelativePath.make("src/index.ts"),
              canonical: "/tmp/slopcode/src/index.ts",
              resource: input.reference === undefined ? "src/index.ts" : `${input.reference}:src/index.ts`,
              mtime: 0,
            }),
          ],
          truncated: false,
          partial: false,
        })
      }),
    grep: (input) =>
      Effect.sync(() => {
        grepSearches.push(input)
        return new LocationSearch.GrepResult({
          items: [
            new LocationSearch.Match({
              path: RelativePath.make("src/index.ts"),
              canonical: "/tmp/slopcode/src/index.ts",
              resource: input.reference === undefined ? "src/index.ts" : `${input.reference}:src/index.ts`,
              lines: "const value = 1",
              linePreviewTruncated: false,
              line: 1,
              offset: 0,
              submatches: [],
              mtime: 0,
            }),
          ],
          truncated: false,
          partial: false,
        })
      }),
  }),
)

const registry = ToolRegistry.defaultLayer.pipe(Layer.provide(permission))
const tools = Layer.mergeAll(GlobTool.layer, GrepTool.layer).pipe(
  Layer.provide(registry),
  Layer.provide(filesystem),
  Layer.provide(search),
  Layer.provide(permission),
)
const it = testEffect(Layer.mergeAll(registry, filesystem, search, permission, tools))
const sessionID = SessionV2.ID.make("ses_search_tool_test")

describe("search tools", () => {
  beforeEach(() => {
    assertions.length = 0
    roots.length = 0
    fileSearches.length = 0
    grepSearches.length = 0
  })

  it.effect("passes canonical root metadata and references through glob", () =>
    Effect.gen(function* () {
      const settled = yield* settleTool(yield* ToolRegistry.Service, {
        sessionID,
        ...toolIdentity,
        call: {
          type: "tool-call",
          id: "call-glob",
          name: "glob",
          input: { pattern: "*.ts", path: "src", reference: "docs", limit: 5 },
        },
      })

      expect(roots).toEqual([{ path: "src", reference: "docs" }])
      expect(fileSearches).toEqual([{ pattern: "*.ts", path: "src", reference: "docs", limit: 5 }])
      expect(assertions).toMatchObject([{ action: "glob", resources: ["*.ts"], metadata: { root: "docs:src" } }])
      expect(settled.output?.content).toEqual([{ type: "text", text: "docs:src/index.ts" }])
    }),
  )

  it.effect("passes canonical root metadata and references through grep", () =>
    Effect.gen(function* () {
      const settled = yield* settleTool(yield* ToolRegistry.Service, {
        sessionID,
        ...toolIdentity,
        call: {
          type: "tool-call",
          id: "call-grep",
          name: "grep",
          input: { pattern: "value", path: "src", reference: "docs", include: "*.ts", limit: 5 },
        },
      })

      expect(roots).toEqual([{ path: "src", reference: "docs", include: "*.ts", limit: 5, pattern: "value" }])
      expect(grepSearches).toEqual([{ pattern: "value", path: "src", reference: "docs", include: "*.ts", limit: 5 }])
      expect(assertions).toMatchObject([{ action: "grep", resources: ["value"], metadata: { root: "docs:src" } }])
      expect(settled.output?.content).toEqual([
        { type: "text", text: "Found 1 matches\n" + "docs:src/index.ts:\n" + "  Line 1: const value = 1" },
      ])
    }),
  )
})
