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

## H5E1 Rejection Remediation

This appendix supersedes the original security, formatter-path, result-validation, matrix-coverage, and aggregate-suite claims above.

Status: `DONE`

### Commits

- Rejected base: `634cf79834`.
- RED: `ce592739c5 test(core): expose H5E1 security gaps`.
- GREEN: `0d2fa74043 fix(core): secure mutation formatting settlement`.
- Matrix: `32e1c6a7e2 test(core): complete H5E1 review matrix`.
- Specs: `f642554188 docs: specify secure mutation formatting`.
- Report: the commit containing this appendix.
- Pushes: none.

### RED Evidence

Command from `packages/core`:

```text
bun test test/mutation-security-review.test.ts
```

Result before production edits: `0 pass, 6 fail`. All six cases failed at the absent `FileMutation.Hooks` descriptor seam. The cases covered target substitution, parent substitution, live-path formatting/concurrent edit, no-op suppression, primitive-result mismatch, and per-boundary epoch fencing.

### Remediation

- Linux mutation now walks from a no-follow root directory descriptor, opens every directory with `O_DIRECTORY | O_NOFOLLOW`, verifies the resulting handle path, and writes existing files through `O_NOFOLLOW` handles. Creation uses an exclusive no-follow child open through the verified parent descriptor. Unsupported platforms fail closed with `FileMutation.UnsupportedPlatformError`.
- Removal opens the child without following links and compares its device/inode identity with the named child immediately before unlink. Deterministic barriers prove a substituted child is rejected and neither the opened original nor symlink destination is deleted.
- Primitive results carry non-enumerable `none`/`created`/`changed`/`deleted` identity plus a service-private WeakMap capability containing immediate bytes and revision. `PostMutation` rejects a forged or mismatched target, resource, or operation before formatter/event work.
- The supplied primitive effect is evaluated exactly once. The formatter's conditional descriptor-safe `commit` is explicitly separate coordinator settlement, not a recursive primitive or semantic event.
- Formatter execution receives a private `0700` temporary directory and exclusive `0600` same-extension stage, never the approved live pathname. Immediate bytes are capped at 16 MiB, BOM repair occurs in staging, and the final commit requires both the primitive revision and immediate bytes. Target swaps, parent swaps, and concurrent edits fail without overwriting the replacement.
- Stage cleanup is scoped across success, expected formatter failure, defect, interruption, and service shutdown. Interruption coverage proves no stale events or diagnostics and no retained stage directory.
- Fence checks now occur before each semantic event, watcher event, diagnostics notification, and final success. Boundary tests prove replacement suppresses all later effects.
- Primitive no-ops and missing deletes skip formatting, events, and diagnostics. Primitive failures and result defects do likewise. A primitive change still emits one mutation event when formatter output is byte-identical.
- Ruff and ocamlformat retain the exact executable path returned by discovery. A real-process test changes `PATH` after positive discovery and proves both cached executables remain pinned.
- Tool tests count/block descriptor mutation through the internal hook rather than instrumenting pathname `FSUtil` writes, preserving exact once-only and sequential interruption/partial-application evidence.

### Added Matrix Evidence

- Descriptor barriers: existing target, prospective parent, delete child identity, formatter target swap, formatter parent swap, and concurrent user edit.
- Coordinator: one supplied effect, opaque result validation, no-op/rejected suppression, byte-identical formatter event, BOM preserve/remove/duplicate repair, every event/diagnostic/success fence, interruption cleanup, and stale conditional commit.
- Formatter: complete catalog/config fold, exact cached ruff/ocamlformat paths, negative rediscovery, concurrent help-probe coalescing, direct argv/metacharacters, sequential execution, bounded output, expected failures, active-Location cwd/environment for external targets, canary redaction, and no `process.env` mutation.
- Existing focused suites remain authoritative for Location reopen/isolation, watcher echo suppression, process timeout/descendant cleanup, runner restart/no replay, direct ToolRegistry mode, CodeMode projection, and partial apply_patch behavior.

### Final Verification

- Focused Core H5E1 matrix, including the new security review: `350 pass, 0 fail`, 14 files, `1122 expect()` calls.
- Core full: `1562 pass, 0 fail`, 163 files, `4867 expect()` calls.
- Slopcode full: `3111 pass, 22 skip, 1 todo, 0 fail`, 248 files, 50 snapshots, `8602 expect()` calls.
- V1 formatter/config compatibility: `105 pass, 0 fail`, 2 files, `173 expect()` calls.
- CodeMode full: `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- Core, server, Slopcode, and CodeMode `bun run typecheck`: pass.
- Root `bun install --frozen-lockfile`: pass, `2372` installs checked across `2656` packages with no changes.
- `git diff --check`: pass.
- Source searches: no formatter/coordinator V1 or Slopcode runtime imports; no implicit shell, `exec`, or `process.env` assignment; no live approved-path formatter call; no direct pathname mutation bypass; no literal discovered ruff/ocamlformat executable; all five tool primitive expressions appear only as the one effect supplied to `post.run`.
- `bunx prettier --check` is advisory and reports repository-style differences in 11 touched legacy files; no formatter rewrite was applied. Typechecks, tests, and whitespace validation are authoritative and green.

### Final Concerns

- None for the requested Linux security and behavioral contract.
- Descriptor-relative mutation intentionally fails closed on non-Linux platforms until an equivalent native adapter is implemented; it does not fall back to vulnerable pathname mutation.

## Atomic Settlement Re-review

This appendix supersedes the preceding delete-atomicity, staging-location, portability, event-fingerprint, and full-matrix claims.

Status: `DONE_WITH_CONCERNS`

### Commits

- Re-review base: `cc46e725be`.
- RED: `c94a895d63 test(core): expose H5E1 atomic settlement gaps`.
- GREEN: `9dd0ccd863 fix(core): make mutation settlement atomic`.
- Specs: `254cec3e58 docs: specify atomic mutation settlement`.
- Report: the commit containing this appendix.
- Pushes: none.

### RED Evidence

Command from `packages/core`:

```text
bun test test/mutation-rereview.test.ts --timeout 2000
```

Result before production edits: `1 pass, 7 fail`. The delete test timed out because no post-check/pre-atomic barrier existed. The other failures proved system-tmp staging, commit-before-fence behavior, absent no-match validation, the 16 MiB durable-mutation failure, missing platform adapter, and completion-time pathname fingerprint adoption.

### Atomic Delete

- `file-mutation-platform.ts` is the explicit platform adapter. Linux/Bun loads libc through FFI and exposes dirfd-relative `renameat2(RENAME_EXCHANGE)`, `renameat2(RENAME_NOREPLACE)`, and `unlinkat` operations.
- Delete opens and records the approved inode, creates an unpredictable exclusive placeholder quarantine, pauses at the deterministic boundary after the prior identity check, and atomically exchanges the public child with the quarantine.
- The quarantined inode is verified against the approved open handle. Mismatch atomically exchanges the replacement back and unlinks only the known placeholder quarantine; the replacement is never deleted.
- Success unlinks the approved random quarantine. Public-name placeholder cleanup is moved with `RENAME_NOREPLACE` into a second unpredictable quarantine, verified against the placeholder handle, and only then unlinked. A substituted public child is restored rather than unlinked.

### Staging And Fencing

- Linux stages through the verified target-directory handle as an unpredictable exclusive `0600` hidden, same-basename-derived, same-extension file. No system tmp path or 16 MiB bound remains.
- Formatter argv uses `/proc/<owner-pid>/fd/<dirfd>/<stage>` so child processes resolve the stable parent handle without inheriting the fd. This is the documented narrow security deviation from canonical target argv.
- A real Prettier integration proves nearest target-directory `.prettierrc` discovery, hidden explicit-file formatting, extension matching, final commit, and cleanup.
- Stage cleanup is registered immediately after exclusive creation and covers before-open, post-create/pre-write, post-write/pre-close, interruption, and scope shutdown. Ordinary stage creation/write inability is a bounded nonfatal `unavailable` formatter outcome after final target validation.
- The coordinator checks the runtime fence after formatter return and immediately before commit. The locked commit rechecks the same guard after revision/content validation and before writing.
- Unmatched formatting and unavailable staging always execute descriptor-backed final identity/revision validation before events. Replacement or edit fails stale with no event.
- Files larger than 16 MiB stage and settle normally; dedicated coverage writes and verifies `16 MiB + 1` byte.

### Portability And Events

- Mock Darwin and Windows adapters retain create/write/conditional-write/delete primitive parity. Because they lack equivalent descriptor security, formatting is skipped with one bounded `unsupported-security` outcome instead of failing write/edit/apply_patch.
- Primitive and formatter commit results retain exact device/inode/size/mtime/ctime/content fingerprints. `MutationEvents.Ownership.complete` now requires that expected fingerprint and never rereads/adopts the pathname.
- A replacement before completion differs from the expected fingerprint and remains publishable as native. Private `.slopcode-` stage paths are ignored both in watcher subscription patterns and callback defense.

### Integration Matrix

- Real `Formatter.layer` execution is covered through write, edit, and sequential apply_patch tool settlement.
- Actual Location-scoped formatter close/reopen proves positive discovery cache disposal and executable rediscovery.
- Watcher stage filtering, timeout-as-nonfatal settlement, restart/no-replay, existing process timeout/tree cleanup, and all prior crash/recovery suites are covered.
- Previous no-op, failed primitive, BOM, once-only primitive, ruff/ocamlformat path pinning, target/parent swaps, diagnostics/event fences, and interruption cleanup remain green.

### Final Verification

- Focused Core H5E1 matrix: `365 pass, 0 fail`, 15 files, `1174 expect()` calls.
- Core full: `1577 pass, 0 fail`, 164 files, `4919 expect()` calls.
- CodeMode full: `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- V1 formatter/config compatibility: `105 pass, 0 fail`, 2 files, `173 expect()` calls.
- Core, server, Slopcode, and CodeMode typechecks: pass.
- Frozen install: `2372` installs checked across `2656` packages, no changes.
- Source audits: no lstat/pathname-unlink sequence, system-tmp staging, stage-size bound, live-target formatter invocation, completion-time fingerprint reread, V1 runtime import, implicit shell, or process-environment mutation.
- `git diff --check`: pass.
- Full Slopcode isolated aggregate: `3110 pass, 22 skip, 1 todo, 1 fail`, 248 files, 50 snapshots, `8604 expect()` calls. The only failure was unrelated `HttpApi Server.listen > graceful stop waits for an overlapping forced stop`; its immediate isolated rerun passed `11/11` with `40 expect()` calls.

### Final Concerns

- The full Slopcode aggregate retained one unrelated timing-sensitive HTTP shutdown failure that passes in isolation.
- Non-Linux adapters deliberately skip post-mutation formatting until equivalent descriptor-relative staging/commit primitives exist; primitive mutation behavior remains available and tested.

## Final Settlement Review

This appendix supersedes every preceding platform, external-stage, delete-recovery, watcher, restart, and verification claim.

Status: `DONE_WITH_CONCERNS`

### Commits

- Final-review base: `0b3e2b3b11`.
- RED: `536663e781 test(core): expose H5E1 final review gaps`.
- GREEN: `a600bb976e fix(core): close H5E1 final settlement races`.
- Specs: `90676164fc docs: specify final H5E1 settlement contract`.
- Report: the commit containing this appendix.
- Pushes: none.

### RED Evidence

`bun test test/mutation-rereview.test.ts --timeout 30000` produced `9 pass, 5 fail`. The rollback test timed out at the absent deterministic barrier; insecure Darwin/Windows mocks still performed pathname mutation; real Prettier loaded the external malicious plugin and exited nonzero; replacement observations received before completion were dropped; and the actual watcher callback adapter did not exist.

### Platform Adapters

- `PlatformInterface` now exposes explicit `mutation`, `staging`, and `exchange` capabilities plus its descriptor namespace. The pathname mutation fallback was deleted.
- Linux uses no-follow directory/file handles, `/proc/self/fd`, owner-process formatter descriptor paths, `renameat2(RENAME_EXCHANGE|RENAME_NOREPLACE)`, and `unlinkat`.
- Darwin uses no-follow directory/file handles, `/dev/fd`, `renameatx_np(RENAME_SWAP|RENAME_EXCL)`, and `unlinkat`. Platform-path guards lock both POSIX descriptor namespaces.
- An adapter without secure mutation capability fails every primitive with `FileMutation.UnsupportedPlatformError` before touching the pathname. Mock Darwin/Windows capability guards prove no file appears and no formatter runs.
- Windows advertises its unavailable capabilities explicitly. There is no reviewed NT handle-relative helper in this tree, so default Windows mutation fails closed rather than preserving the former vulnerable pathname behavior. The adapter boundary permits a separately reviewed native helper, but this change does not ship one.
- Because unsupported platforms cannot complete a primitive, `unsupported-security` was removed from formatter outcome taxonomy.

### External Staging

- `LocationMutation.Target` carries a Location-owned stage root only for external targets.
- Internal files retain exclusive hidden `0600`, same-basename-derived, same-extension staging under the verified target dirfd, preserving nearest config behavior.
- External files stage under the verified active Location root and never beside the external target. Formatter cwd, discovery, package roots, and configuration remain Location-owned.
- Real Prettier coverage places a throwing plugin and hostile `.prettierrc` beside the external file, proves neither loads, proves the active Location `.prettierrc` applies, and verifies both roots contain no stage residue.

### Delete Recovery

- Delete tracks placeholder identity and its current `placeholder`, `approved`, `public`, `done`, or `conflict` role through a scoped finalizer.
- Deterministic barriers now cover pre-exchange, post-exchange, placeholder movement, and rollback.
- Mismatch rollback uses atomic exchange. Placeholder cleanup uses exclusive no-replace movement and identity verification.
- If a concurrent public child blocks restoration, `FileMutation.RecoveryConflictError` surfaces the canonical recovery path. The public replacement and displaced replacement remain intact; unrelated entries are never unlinked silently.
- Finalization unlinks only a name still matching the generated placeholder identity and restores the approved inode only while both expected identities remain present.

### Watcher And Restart

- Mutation ownership retains the latest in-flight native event, observed fingerprint, and publish effect rather than dropping callbacks.
- Completion compares the retained fingerprint with the exact validated final fingerprint. Matching echoes are suppressed; genuine replacements publish immediately after the coordinator's direct event. Cancellation publishes retained genuine observations.
- The exported callback adapter is the same implementation installed into Parcel watcher subscriptions. Its integration test invokes a replacement callback before completion and verifies deterministic direct-then-native order.
- The runner recovery integration now rebuilds `SessionExecutionLocal` over persisted interrupted-tool events, explicitly resumes it, proves the stale tool executor is not called, and verifies durable interrupted failure context. It is no longer an unused PostMutation scope reopen.

### Final Verification

- Final focused H5E1 matrix: `100 pass, 0 fail`, 11 files, `299 expect()` calls.
- New final-review contracts plus mutation events: `16 pass, 0 fail`, `56 expect()` calls.
- Durable runner restart/no-replay integration: `1 pass, 0 fail`, `4 expect()` calls.
- Core full: `1581 pass, 0 fail`, 164 files, `4928 expect()` calls.
- Slopcode full: `3111 pass, 22 skip, 1 todo, 0 fail`, 248 files, 50 snapshots, `8602 expect()` calls.
- V1 formatter/config compatibility: `105 pass, 0 fail`, 2 files, `173 expect()` calls.
- CodeMode full: `254 pass, 0 fail`, 7 files, `744 expect()` calls.
- Core, server, Slopcode, and CodeMode typechecks: pass.
- Frozen install: `2372` installs checked across `2656` packages, no changes.
- Source audits: no pathname fallback, `unsupported-security`, insecure adapter marker, direct target unlink, live-target formatter call, implicit shell, `exec`, or process-environment assignment.
- `git diff --check`: pass.

### Final Concerns

- Windows now fails closed because this repository does not contain the separately reviewed NT handle-relative native helper required to preserve mutation securely. Linux is runtime-verified; Darwin is implementation- and guard-covered but was not runtime-tested on Darwin hardware in this Linux environment.
