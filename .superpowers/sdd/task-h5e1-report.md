# H5E1 Mutation Formatting Report

Status: `DONE_WITH_CONCERNS`

Core V2 now owns Location-scoped mutation formatting and ordered post-mutation settlement. Write, edit, and apply_patch use one coordinator after approval; V1 remains compatibility evidence only. No public route, SDK, CLI/TUI surface, LSP implementation, snapshot behavior, or H6+ work was added.

## Commits

- Base: `423a46b8cb403af31673b5b328f57dc239cb04a8`.
- RED: `5fc0741e03 test(core): define mutation formatting contract`.
- GREEN: `e82a2d2299 feat(core): coordinate mutation formatting`.
- Specs: `1c2c9b8e4b docs: define V2 mutation formatting`.
- Report: the commit containing this file.
- Pushes: none.

## Architecture And APIs

- `Formatter.Service` is built once per Location generation from `Config.entries()`. It exposes internal `format(target)`, `list()`, and `status()` effects.
- `PostMutation.Service.run(input)` accepts the immutable approved target, operation intent, one primitive mutation effect, and an optional runtime fence. It returns primitive identity plus bounded formatter and final-byte status.
- `MutationEvents.Service` provides `begin(canonical)` ownership and `native(canonical, event)` reconciliation.
- `PostMutation.Diagnostics` is a typed Location-scoped no-op seam for H5E2.
- `FileMutation` remains the byte primitive. It gained only canonical target/parent revalidation and still owns no discovery, process, event, diagnostic, or Session behavior.
- `LocationServiceMap` explicitly scopes formatter, coordinator, reconciler, diagnostics, watcher sharing, and shutdown.

## Effective Configuration

Documents fold low to high priority. Omission retains state; booleans replace it; an object after a boolean starts fresh enabled object state; consecutive objects merge entry fields and environments while arrays replace. Built-ins retain fixed order. Custom entries append by first-seen property order, retain their slot through overrides, and are removed when disabled. Unsafe environments, empty command arguments, and incomplete custom entries become safe absent configuration.

`ruff` and `uv` are disable-coupled. If enabled, ruff discovery wins and uv is considered only if ruff is unavailable. Lookup uses public `clang-format`, `air`, and `uv` names, intentionally fixing V1's `clang`, `rlang`, and `uvformat` export-key ambiguity. Location close/reopen rebuilds config, catalog, cache, pending discovery, and status.

## Catalog

| Name | Extensions | Discovery | Argv tail |
| --- | --- | --- | --- |
| gofmt | `.go` | PATH | `-w $FILE` |
| mix | `.ex .exs .eex .heex .leex .neex .sface` | PATH | `format $FILE` |
| prettier | full V1 web list | package dependency + npm | `--write $FILE` |
| oxfmt | JS/TS list | runtime flag + package dependency + npm | `$FILE` |
| biome | full V1 web list | config + npm | `format --write $FILE` |
| zig | `.zig .zon` | PATH | `fmt $FILE` |
| clang-format | V1 C/C++/Arduino list | config + PATH | `-i $FILE` |
| ktlint | `.kt .kts` | PATH | `-F $FILE` |
| ruff | `.py .pyi` | PATH + ordered config/dependency evidence | `format $FILE` |
| air | `.R` | PATH + bounded help | `format $FILE` |
| uv | `.py .pyi` | no ruff + PATH + bounded help | `format -- $FILE` |
| rubocop | `.rb .rake .gemspec .ru` | PATH | `--autocorrect $FILE` |
| standardrb | `.rb .rake .gemspec .ru` | PATH | `--fix $FILE` |
| htmlbeautifier | `.erb .html.erb` | PATH | `$FILE` |
| dart | `.dart` | PATH | `format $FILE` |
| ocamlformat | `.ml .mli` | PATH + config | `-i $FILE` |
| terraform | `.tf .tfvars` | PATH | `fmt $FILE` |
| latexindent | `.tex` | PATH | `-w -s $FILE` |
| gleam | `.gleam` | PATH | `format $FILE` |
| shfmt | `.sh .bash` | PATH | `-w $FILE` |
| nixfmt | `.nix` | PATH | `$FILE` |
| rustfmt | `.rs` | PATH | `$FILE` |
| pint | `.php` | Composer dependency | `./vendor/bin/pint $FILE` |
| ormolu | `.hs` | PATH | `-i $FILE` |
| cljfmt | `.clj .cljs .cljc .edn` | PATH | `fix --quiet $FILE` |
| dfmt | `.d` | PATH | `-i $FILE` |

The exact prettier/biome and C/C++ arrays are locked in `formatter.test.ts` and listed in `specs/v2/formatter.md`. Matching remains case-sensitive `path.extname`; `.html.erb` therefore remains in the compatibility list while matching as `.erb`. `BUN_BE_BUN=1`, bounded upward searches, ordered ruff checks, and oxfmt experimental inheritance are preserved.

## Discovery And Process Safety

Discovery starts lazily only for matching extensions. Positive argv is cached for the Location generation; every negative result is retried. Concurrent same-entry discovery shares a deferred. Its owner publishes success, failure, defect, or interruption to waiters and stale completion cannot populate a closed generation.

Matching discovery may run concurrently, but collection and execution preserve catalog order. Commands use direct `ChildProcess` argv. Every `$FILE` occurrence becomes the approved canonical path, no target is appended without a placeholder, cwd remains the Location, and external target directories never become discovery roots. Child environments extend inherited values with built-in then configured values without mutating or exposing `process.env`.

Discovery probes are bounded at 10 seconds; attempts at 120 seconds; retained stdout and stderr at 64 KiB each while both continue draining. Outcomes are only `formatted`, `unavailable`, `spawn-error`, `timeout`, or `nonzero`, plus safe counts/flags/exit code. Expected failures remain nonfatal; defects and interruption remain operational. `AppProcess` reports total byte counts and scoped process cleanup terminates and awaits descendants on the tested platform.

## Coordination, BOM, And Events

Settlement order is ownership, exactly one primitive mutation, immediate bytes, fence, sequential formatting, final bytes/BOM repair, fence, canonical events, reconciliation completion, diagnostics, fence, success. Deleted files skip formatting and `file.edited`; all successful operations publish exactly one direct watcher add/change/unlink event.

Immediate BOM presence is authoritative. Final output has all leading BOMs removed, then exactly one restored only if immediate bytes had one. `changed` compares repaired final bytes against immediate bytes.

Direct mutation owns the semantic event. Native callbacks normalize paths and compare current filesystem identity with the retained direct-mutation fingerprint. In-flight and delayed formatter echoes, including a delayed temporary unlink while the final file exists, are suppressed. A genuinely changed later identity publishes and clears suppression. Interruption/defect cancels incomplete ownership; Location shutdown clears all state.

## Runtime And Recovery

`ToolRegistry` attaches a non-enumerable internal fence. Runner materialization supplies exact V2 owner/draining/epoch checks; direct calls use an explicit always-current fence. Checks occur before mutation, before formatter work, before events/diagnostics, and before success. Existing runner replacement races interrupt formatter work and scoped process cleanup settles before the tool terminal.

An uncertain interrupted/crashed tool remains on the existing interrupted/unknown recovery path. Startup does not rerun a primitive or formatter and does not synthesize an event. Existing durable-success and recovery suites remained green.

## External Security

Only the approved canonical `LocationMutation.Target` is used. No formatter/coordinator target resolution is performed. Every primitive revalidates the canonical target or parent inside its lock, and the symlink-swap test proves an approved target replaced by an escaping symlink cannot alter the external file. Approved external targets retain the active Location catalog, cwd, package boundary, service graph, and event spelling.

## Internal Status

Formatter status exposes only name, extensions, configured/available booleans, and bounded availability code. Post-mutation status exposes operation, canonical target, model resource, event, match state, ordered bounded outcomes, final-difference state, and final bytes. Executable paths, argv, environments, process output, and secrets are absent. No public surface was introduced.

## RED Evidence

Command from `packages/core`:

```text
bun test test/formatter.test.ts test/post-mutation.test.ts test/mutation-events.test.ts
```

Result before production files: `0 pass`, `3 fail`, `3 errors`; module resolution failed for missing `@slopcode-ai/core/formatter` and `@slopcode-ai/core/mutation-events`.

## GREEN Verification

- Focused Core H5E1 matrix: `bun test test/formatter.test.ts test/post-mutation.test.ts test/mutation-events.test.ts test/config/config.test.ts test/process/process.test.ts test/filesystem/watcher.test.ts test/location-mutation.test.ts test/file-mutation.test.ts test/tool-write.test.ts test/tool-edit.test.ts test/tool-apply-patch.test.ts test/tool-registry.test.ts test/session-runner.test.ts test/session-execution-local.test.ts`; `335 pass, 0 fail`, `1073 expect()` calls. Final watcher/coordinator reconciliation rerun: `8 pass, 0 fail`.
- Core full: `bun test`; `1547 pass, 0 fail`, 162 files, `4819 expect()` calls.
- V1 formatter/config evidence: `bun test test/format/format.test.ts test/config/config.test.ts`; `105 pass, 0 fail`, 2 files, `173 expect()` calls.
- CodeMode full: `bun test`; `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- Core, server, and CodeMode `bun run typecheck` passed. Slopcode's first parallel typecheck exceeded 180 seconds and received SIGTERM; its isolated rerun with a 600-second command bound passed.
- Repository-root `bun install --frozen-lockfile` passed: `Checked 2372 installs across 2656 packages (no changes)`.
- `git diff --check` passed.
- Source searches found no formatter/coordinator V1, `packages/slopcode`, or `@/` import; no implicit shell, raw output/environment logging, `process.env` assignment, or obsolete formatter/event TODO.
- Mutation-tool source search found each `FileMutation` invocation only as the primitive effect passed to `post.run`; no direct execution bypass remains.
- Process descendant evidence: `timeout terminates and awaits a spawned descendant` passed in focused and full Core runs.
- Event evidence: coordinator order test and reconciler identity test passed; the latter covers in-flight, delayed add/change/unlink echoes, and a genuine later change.
- Output/secret boundary evidence: retained output is bounded and status/result schemas contain no raw output/environment/argv; source logging searches were empty.
- Generated `.slopcode/package-lock.json` from verification was removed and is not retained.

## Slopcode Full-Suite Timeout

`bun test --timeout 30000` from `packages/slopcode` exceeded the 900-second command limit before a final summary. The completed portion showed no failures, but this run is not represented as passing. The focused V1 formatter/config suite and isolated Slopcode typecheck passed.

## Changed Files

| Path | Purpose |
| --- | --- |
| `packages/core/src/formatter.ts` | catalog, config fold, discovery, safe execution, internal status |
| `packages/core/src/post-mutation.ts` | ordered coordinator, BOM repair, events, diagnostics, status |
| `packages/core/src/mutation-events.ts` | direct/native event ownership and identity reconciliation |
| `packages/core/src/file-mutation.ts` | canonical target/parent race revalidation |
| `packages/core/src/filesystem/watcher.ts` | normalized native event reconciliation |
| `packages/core/src/flag/flag.ts` | runtime-testable oxfmt experimental flag |
| `packages/core/src/process.ts` | drained output byte counts |
| `packages/core/src/location-layer.ts` | explicit Location service ownership and shutdown graph |
| `packages/core/src/session/runner/llm.ts` | active runtime fence attachment |
| `packages/core/src/tool/tool.ts` | internal tool fence context type |
| `packages/core/src/tool/registry.ts` | non-model fence materialization and capture |
| `packages/core/src/tool/write.ts` | coordinated write settlement |
| `packages/core/src/tool/edit.ts` | coordinated edit settlement |
| `packages/core/src/tool/apply-patch.ts` | sequential coordinated hunk settlement |
| `packages/core/test/formatter.test.ts` | config/catalog/argv/order/output/outcome/isolation contracts |
| `packages/core/test/post-mutation.test.ts` | ordered format/BOM/event/diagnostic/status contract |
| `packages/core/test/mutation-events.test.ts` | in-flight/delayed/genuine native identity behavior |
| `packages/core/test/file-mutation.test.ts` | post-approval escaping symlink swap rejection |
| `packages/core/test/process/process.test.ts` | descendant process cleanup |
| `packages/core/test/tool-write.test.ts` | coordinator fixture integration |
| `packages/core/test/tool-edit.test.ts` | coordinator fixture integration |
| `packages/core/test/tool-apply-patch.test.ts` | coordinator fixture and partial-order integration |
| `specs/v2/formatter.md` | canonical formatter contract and V1 deviations |
| `specs/v2/mutation.md` | canonical coordinator/event/fence contract |

## Checklist

- PASS: Core-owned Location formatter with no V1 runtime delegation.
- PASS: effective boolean/object merge, ordering, validation, aliases, and ruff/uv coupling.
- PASS: complete supported catalog, exact extension arrays, documented discovery/argv, and oxfmt flag.
- PASS: lazy positive cache, negative retry, concurrent coalescing, and Location lifecycle cleanup.
- PASS: direct canonical argv, Location cwd, environment validation, fixed bounds, and descendant cleanup.
- PASS: expected nonfatal formatter outcomes remain distinct from defects/interruption.
- PASS: primitive/coordinator ownership, sequential tools/patches, BOM repair, and partial application.
- PASS: canonical final events, native fingerprint reconciliation, and typed no-op diagnostics seam.
- PASS: internal runtime fencing and existing conservative tool recovery semantics.
- PASS: external targets and symlink swaps cannot widen authority.
- PASS: internal status is bounded and no public formatter surface exists.
- PASS: LSP, snapshots, H6-H9, SDK regeneration, and unrelated V1 changes stayed out of scope.
- CONCERN: the full Slopcode aggregate suite timed out without a final result.
- CONCERN: formatter-specific tests do not independently inject every requested Session crash window; the implementation uses the existing runner fence/recovery path, whose complete runner and execution-local suites passed.

## Final Disposition

`DONE_WITH_CONCERNS`: implementation, canonical specs, focused/full Core, V1 evidence, CodeMode, all typechecks, frozen install, and source gates are complete and green. The only verification gaps are the timed-out aggregate Slopcode run and the absence of a dedicated formatter-specific test for every individual runner crash window.
