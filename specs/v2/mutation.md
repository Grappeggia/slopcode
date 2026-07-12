# V2 File Mutation Coordination

`FileMutation` remains the deterministic byte-level primitive. It performs one approved create, write, conditional write, or remove under a canonical-target lock. It does not discover formatters, start processes, publish events, inspect Session epochs, run diagnostics, or claim a multi-file transaction.

On Linux, mutation walks the absolute parent from a no-follow root directory handle, opens each directory with `O_DIRECTORY | O_NOFOLLOW`, and mutates only through the verified parent or file handle. Existing targets are opened with `O_NOFOLLOW`, checked against the approved canonical identity, and written through that handle. Creation uses an exclusive no-follow child open relative to the verified parent handle. Removal opens the child without following links and compares the named identity with the opened identity immediately before unlink. A pathname substituted after a handle opens is never followed. Platforms without an equivalent adapter fail closed with `FileMutation.UnsupportedPlatformError`.

## Post-Mutation Order

Write, edit, and apply_patch resolve paths and complete `external_directory` and `edit` authorization before invoking `PostMutation`. For one target, the coordinator:

1. Checks the optional Session runtime fence.
2. Registers direct-event ownership before touching bytes.
3. Executes exactly one `FileMutation` primitive.
4. Takes the primitive's opaque immediate-byte and file-revision snapshot and checks the fence.
5. Copies bounded immediate bytes into a private same-extension staging file and runs every matching formatter sequentially there; deletes and primitive no-ops skip formatting.
6. Restores exact UTF-8 BOM presence in staging and conditionally commits final bytes through the descriptor-safe formatter commit only if the approved target still has the primitive revision and bytes.
7. Checks the fence immediately before each canonical semantic and watcher event.
8. Completes event reconciliation, checks the fence, and invokes the typed diagnostics seam.
9. Checks the fence immediately before returning durable tool success.

The diagnostics service is a Location-scoped no-op in H5E1. H5E2 may replace it without changing this order. This contract adds no LSP implementation.

## Result And BOM Policy

The internal result contains primitive operation, canonical target, model-facing resource, exact `none`/`created`/`changed`/`deleted` identity, add/change/unlink event, whether an event was emitted, whether a formatter matched, ordered bounded formatter outcomes, whether final bytes differ from immediate bytes, and final byte count. Primitive results carry an opaque service-local capability tied to their immediate bytes and revision; the coordinator rejects forged or mismatched operation, target, or resource results. It is not a public API.

The coordinator records whether immediate post-mutation bytes have a UTF-8 BOM. After every formatter attempt it strips all leading BOMs and restores exactly one only when the immediate bytes had one. BOM repair occurs in staging. The final descriptor-safe conditional commit is distinct coordinator settlement work, not a recursive `FileMutation` primitive invocation or event. Deleted targets have zero final bytes.

## Events

A successful changed nondelete publishes one `file.edited` event and every successful changed mutation publishes one watcher `add`, `change`, or `unlink`. Both use the approved canonical target; model output continues using the approved resource. Same-content writes and missing deletes publish no event or diagnostics. A formatter that leaves final bytes equal to immediate bytes still publishes because the primitive changed. Events occur only after formatter and BOM work settle.

Direct mutation owns the semantic event. `MutationEvents` suppresses in-flight native updates and retains the final filesystem identity after settlement. Delayed native add/change/unlink observations are suppressed while the actual identity still matches, not by elapsed-time debounce. A genuinely different later filesystem identity clears suppression and publishes normally. Paths are normalized, and Location shutdown clears active and settled ownership. Direct events remain available when native watching is disabled or unavailable.

## Batches And Failure

Apply_patch preparation, validation, and permissions precede content reads. Prepared hunks execute in mutation order through `PostMutation`; each add or update finishes formatting and events before the next hunk, while deletes skip formatting. Expected formatter outcomes do not fail a patch. A later primitive failure keeps earlier bytes, formatting, and events and reports the existing explicit partial-application list. There is no rollback, snapshot, atomic batch, or multi-file transaction.

## Runtime Fencing And Recovery

Runner tool materialization supplies an internal fence for exact owner `v2`, state `draining`, and runtime epoch. The fence is not model input. Direct function/test use receives an explicit always-current fence. Checks occur before mutation, before formatting, before events/diagnostics, and before success. The runner's existing replacement/interruption race encompasses formatter execution, and scoped process cleanup completes before settlement.

Interruption or a defect cancels unfinished event ownership. If mutation durability is uncertain, the existing runner settlement remains interrupted or unknown. Startup recovery never reruns a file primitive or formatter and never synthesizes missing file events. Already durable successful calls remain nonrepeatable. See [session.md](./session.md) for the owner/state/epoch state machine.

## External Targets

Only the immutable `LocationMutation.Target` approved before mutation is accepted. The coordinator and formatter do not resolve the user spelling again. Approved external files use the current Location's catalog, configuration, process cwd, package-search root, and service lifecycle. No Location or discovery service is opened from the external target's directory.
