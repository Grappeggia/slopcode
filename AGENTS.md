- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Before publishing a release or npm package, rebase the publish branch/worktree onto the latest remote base branch tip (`origin/dev` here, or `origin/main` in repos that use `main`) so npm publishes always start from the current base.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- For UI or layout work that could apply to both clients, prioritize the TUI implementation in `packages/slopcode` first unless the user explicitly asks for web-only behavior.
- For Android/Termux interactive or TUI issues, reproduce through adb on an Android emulator with Termux and npm preinstalled before claiming a fix.
- When publishing a release or npm package, update the GitHub release notes as part of the default flow and make sure the changelog is visible on `slopcode.dev` as well. Do not leave releases with placeholder notes; write clear changelogs as at most 3 very short bullet points covering the shipped changes.
- The default release flow is `bun run release patch` from a clean worktree. Use `minor`, `major`, or an explicit version only when the user explicitly asks for a different bump.
- When asked to ship, rebase onto `origin/dev`, test and iterate until passing, commit and push the implementation, then cut the release with the default release flow.
- `bun run release` prepares version changes and build artifacts locally, uploads the prebuilt assets to the GitHub release, then dispatches `.github/workflows/publish.yml` on `dev` for npm trusted publishing.
- Do not use local `npm publish` as the normal release path. GitHub Actions should only handle the publish/finalize step, using the prebuilt assets and npm trusted publishing without OTP.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/slopcode`.
