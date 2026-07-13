# V2 File Mutation Coordination

`FileMutation` remains the deterministic byte-level primitive. It performs one approved create, write, conditional write, or remove under a canonical-target lock. It does not discover formatters, start processes, publish events, inspect Session epochs, run diagnostics, or claim a multi-file transaction.

On Linux and Darwin under Bun, mutation walks the absolute parent from a no-follow root directory handle, opens each directory with `O_DIRECTORY | O_NOFOLLOW`, and mutates only through the verified parent or file handle. Linux uses `/proc/self/fd`; Darwin uses `/dev/fd`. Existing targets are opened with `O_NOFOLLOW`, checked against the approved canonical identity, and written through that handle. Creation uses an exclusive no-follow child open relative to the verified parent handle. Removal creates an unpredictable exclusive placeholder under the verified dirfd, atomically exchanges the public child and quarantine with Linux `renameat2(RENAME_EXCHANGE)` or Darwin `renameatx_np(RENAME_SWAP)`, verifies the quarantined inode, restores a mismatched replacement by exchange, and unlinks only verified quarantines with `unlinkat`. Placeholder cleanup uses exclusive no-replace rename and identity verification before unlink. There is no identity-check/pathname-unlink gap.

The explicit platform adapter advertises mutation, staging, and exchange capabilities independently of platform names. Darwin advertises secure primitive mutation and exchange but not formatter staging until a known child fd can be explicitly inherited; a changed primitive settles with one bounded nonfatal `unsupported-security` formatter outcome and no child execution. Windows currently advertises none: Core has no reviewed NT handle-relative helper, so every primitive fails closed with `FileMutation.UnsupportedPlatformError`. There is no pathname fallback. A Windows distribution may enable mutation only by supplying a separately reviewed native adapter that preserves no-reparse parent handles, verified final paths, handle-relative create/delete, and identity-safe commit semantics.

## Post-Mutation Order

Write, edit, and apply_patch resolve paths and complete `external_directory` and `edit` authorization before invoking `PostMutation`. For one target, the coordinator:

1. Checks the optional Session runtime fence.
2. Registers direct-event ownership before touching bytes.
3. Executes exactly one `FileMutation` primitive.
4. Takes the primitive's opaque immediate-byte and file-revision snapshot and checks the fence.
5. On Linux, an internal target receives an unpredictable exclusive `0600` hidden stage beside the target through its stable verified directory handle; an external target receives that same basename/extension-preserving stage under the verified active Location root. Linux passes the owner-process descriptor path, copies immediate bytes, and runs matching formatters sequentially. Darwin and unsupported secure-staging adapters create no stage and execute no formatter. Deletes and primitive no-ops also skip formatting.
6. Checks the runtime fence after formatter return and immediately before commit. It restores exact UTF-8 BOM presence in staging and conditionally commits final bytes through the descriptor-safe formatter commit only if the approved target still has the primitive revision and bytes; the same guard is checked inside the locked commit.
7. Checks the fence immediately before each canonical semantic and watcher event.
8. Completes event reconciliation, checks the fence, and invokes the typed diagnostics seam.
9. Checks the fence immediately before returning durable tool success.

The diagnostics service is a Location-scoped no-op in H5E1. H5E2 may replace it without changing this order. This contract adds no LSP implementation.

## Result And BOM Policy

The internal result contains primitive operation, canonical target, model-facing resource, exact `none`/`created`/`changed`/`deleted` identity, add/change/unlink event, whether an event was emitted, whether a formatter matched, ordered bounded formatter outcomes, whether final bytes differ from immediate bytes, and final byte count. Primitive results carry an opaque service-local capability tied to immediate bytes, revision, and the exact approved target object including staging authority. The coordinator rejects forged or mismatched operation, target, resource, or reconstructed staging results before formatter or event work. It is not a public API.

The coordinator records whether immediate post-mutation bytes have a UTF-8 BOM. After every formatter attempt it strips all leading BOMs and restores exactly one only when the immediate bytes had one. BOM repair occurs in staging. The final descriptor-safe conditional commit is distinct coordinator settlement work, not a recursive `FileMutation` primitive invocation or event. Deleted targets have zero final bytes.

## Events

A successful changed nondelete publishes one `file.edited` event and every successful changed mutation publishes one watcher `add`, `change`, or `unlink`. Both use the approved canonical target; model output continues using the approved resource. Same-content writes and missing deletes publish no event or diagnostics. A formatter that leaves final bytes equal to immediate bytes still publishes because the primitive changed. Events occur only after formatter and BOM work settle.

Direct mutation owns the semantic event. `MutationEvents` receives the exact validated/committed final fingerprint and never rereads the pathname during completion. The watcher fingerprints and retains the latest native observation received during ownership instead of dropping it. Completion suppresses only a retained observation matching the exact final fingerprint; a replacement is published immediately after the direct event. Private `.slopcode-` stage events are ignored by the actual watcher callback adapter. Paths are normalized, and Location shutdown clears active, retained, and settled ownership. Direct events remain available when native watching is disabled or unavailable.

## Batches And Failure

Apply_patch preparation, validation, and permissions precede content reads. Prepared hunks execute in mutation order through `PostMutation`; each add or update finishes formatting and events before the next hunk, while deletes skip formatting. Expected formatter outcomes do not fail a patch. A later primitive failure keeps earlier bytes, formatting, and events and reports the existing explicit partial-application list. There is no rollback, snapshot, atomic batch, or multi-file transaction.

## Runtime Fencing And Recovery

Runner tool materialization supplies an internal fence for exact owner `v2`, state `draining`, and runtime epoch. The fence is not model input. Direct function/test use receives an explicit always-current fence. Checks occur before mutation, before formatting, before events/diagnostics, and before success. The runner's existing replacement/interruption race encompasses formatter execution, and scoped process cleanup completes before settlement.

Interruption or a defect cancels unfinished event ownership and publishes a retained genuine native observation. If mutation durability is uncertain, the existing runner settlement remains interrupted or unknown. Startup recovery never reruns a file primitive or formatter and never synthesizes missing file events. A rebuilt execution-service integration resumes a persisted interrupted local tool, durably marks it failed, and proves its executor is not called again. Already durable successful calls remain nonrepeatable. See [session.md](./session.md) for the owner/state/epoch state machine.

## External Targets

Only the immutable `LocationMutation.Target` approved before mutation is accepted. The coordinator and formatter do not resolve the user spelling again. External files are never staged beside the external target: their stage lives under the verified active Location root, while process cwd, catalog, discovery, package-search root, and service lifecycle remain Location-owned. Consequently an external `.prettierrc`, plugin, package boundary, or executable cannot participate. Internal targets retain same-directory staging and nearest-config parity.

## Delete Recovery

Delete tracks the identity and current role of every generated quarantine and placeholder until scope completion. Deterministic barriers cover pre-exchange, post-exchange, placeholder movement, and rollback. A mismatch is restored atomically by exchange or exclusive rename. After any post-exchange failure, the held dirfd is used to inspect every known canonical/quarantine/cleanup name at throw time. `RecoveryConflictError` contains only observed existing paths and aligned device/inode identities. If no known entry remains, the bounded `OperationFailureError` carries the operation state without fabricating a recovery path. It never unlinks the conflicting public entry or displaced replacement, and no observed hidden entry is omitted. Scoped finalizers unlink only a name whose current identity is the generated placeholder and restore the approved inode only when both identities still match.
