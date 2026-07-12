# V2 File Mutation Coordination

`FileMutation` remains the deterministic byte-level primitive. It performs one approved create, write, conditional write, or remove under a canonical-target lock. It does not discover formatters, start processes, publish events, inspect Session epochs, run diagnostics, or claim a multi-file transaction.

Before touching bytes, each primitive revalidates the approved canonical target or canonical parent. A target replaced by an escaping symlink after approval fails closed with `FileMutation.TargetChangedError`.

## Post-Mutation Order

Write, edit, and apply_patch resolve paths and complete `external_directory` and `edit` authorization before invoking `PostMutation`. For one target, the coordinator:

1. Checks the optional Session runtime fence.
2. Registers direct-event ownership before touching bytes.
3. Executes exactly one `FileMutation` primitive.
4. Reads immediate bytes for a nondeleted target and checks the fence.
5. Runs every matching formatter sequentially; deletes skip formatting.
6. Restores exact UTF-8 BOM presence, reads final bytes, and compares them with immediate bytes.
7. Checks the fence, then publishes canonical events.
8. Completes event reconciliation and invokes the typed diagnostics seam.
9. Checks the fence immediately before returning durable tool success.

The diagnostics service is a Location-scoped no-op in H5E1. H5E2 may replace it without changing this order. This contract adds no LSP implementation.

## Result And BOM Policy

The internal result contains primitive operation, canonical target, model-facing resource, existence state, add/change/unlink event, whether a formatter matched, ordered bounded formatter outcomes, whether final bytes differ from immediate bytes, and final byte count. It is not a public API.

The coordinator records whether immediate post-mutation bytes have a UTF-8 BOM. After every formatter attempt it strips all leading BOMs and restores exactly one only when the immediate bytes had one. BOM repair uses the primitive service but remains inside the same coordinator settlement. Deleted targets have zero final bytes.

## Events

A successful nondelete publishes one `file.edited` event and every successful mutation publishes one watcher `add`, `change`, or `unlink`. Both use the approved canonical target; model output continues using the approved resource. Events occur only after formatter and BOM work settle.

Direct mutation owns the semantic event. `MutationEvents` suppresses in-flight native updates and retains the final filesystem identity after settlement. Delayed native add/change/unlink observations are suppressed while the actual identity still matches, not by elapsed-time debounce. A genuinely different later filesystem identity clears suppression and publishes normally. Paths are normalized, and Location shutdown clears active and settled ownership. Direct events remain available when native watching is disabled or unavailable.

## Batches And Failure

Apply_patch preparation, validation, and permissions precede content reads. Prepared hunks execute in mutation order through `PostMutation`; each add or update finishes formatting and events before the next hunk, while deletes skip formatting. Expected formatter outcomes do not fail a patch. A later primitive failure keeps earlier bytes, formatting, and events and reports the existing explicit partial-application list. There is no rollback, snapshot, atomic batch, or multi-file transaction.

## Runtime Fencing And Recovery

Runner tool materialization supplies an internal fence for exact owner `v2`, state `draining`, and runtime epoch. The fence is not model input. Direct function/test use receives an explicit always-current fence. Checks occur before mutation, before formatting, before events/diagnostics, and before success. The runner's existing replacement/interruption race encompasses formatter execution, and scoped process cleanup completes before settlement.

Interruption or a defect cancels unfinished event ownership. If mutation durability is uncertain, the existing runner settlement remains interrupted or unknown. Startup recovery never reruns a file primitive or formatter and never synthesizes missing file events. Already durable successful calls remain nonrepeatable. See [session.md](./session.md) for the owner/state/epoch state machine.

## External Targets

Only the immutable `LocationMutation.Target` approved before mutation is accepted. The coordinator and formatter do not resolve the user spelling again. Approved external files use the current Location's catalog, configuration, process cwd, package-search root, and service lifecycle. No Location or discovery service is opened from the external target's directory.
