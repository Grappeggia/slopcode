# Task 02 Report

## Result

Implemented strict, route-aware OpenAI Responses replay hardening without database or schema migrations.

## Changes

- Added outbound-only replay item ID validation using the future-compatible `prefix_suffix` structural rule. Reasoning IDs, custom tool item IDs, and hosted-tool item references are filtered at wire lowering while persisted provider metadata remains untouched.
- Tightened stateless reasoning replay so `store: false` retains a reasoning item only when it has a structurally valid ID and non-empty encrypted content. Ordinary assistant text remains in its original order when reasoning metadata is discarded.
- Changed `store: false` request lowering to merge `reasoning.encrypted_content` into supported caller includes exactly once. `store: true` requests retain their previous include behavior.
- Added the typed `reasoningSummaryDelivery: "sequential_cutoff"` OpenAI option and encoded it as `stream_options.reasoning_summary_delivery` only when the route advertises the new `sequential-cutoff` capability.
- Added the capability only to the explicit Codex route created by session model resolution. Public OpenAI, Azure, Copilot, XAI, OpenRouter, and generic compatible routes do not receive it.
- Implemented the same sequential-cutoff parser state machine for HTTP and WebSocket Responses: partial summary deltas are ignored; atomic summary `done` events are accepted only for an active reasoning item; duplicate indexes/items, interrupted items, done-only items, and late stale events are discarded; completed summaries and normal output text are preserved.
- Wired the Codex session request to request sequential-cutoff delivery. Public session requests omit it.
- Updated the existing stateless cache recording request fixture for the mandatory encrypted reasoning include.

## Boundary Rule

For a Codex request that explicitly selects sequential cutoff, `response.output_item.added` opens one reasoning item. Only unique `response.reasoning_summary_text.done` indexes for that open item are emitted. `response.output_item.done` closes the item and attaches its final encrypted metadata. Starting a different output item cuts off any unfinished reasoning item; all later events for a closed or cut-off item are ignored. Non-Codex routes continue using the legacy delta parser.

## TDD And Coverage

Tests were added first and failed for missing ID filtering, mandatory include merging, Codex wire encoding, and cutoff parsing. Implementation then made them pass.

Coverage includes:

- Valid known and unknown item prefixes.
- Missing underscore, empty prefix, empty suffix, and empty IDs.
- Non-empty, empty, and absent encrypted reasoning state.
- Include omission, empty/invalid includes, supported-field preservation, deduplication, and `store: true`.
- Public and excluded-route cutoff omission and legacy parser behavior.
- HTTP and WebSocket sequential-cutoff parsing.
- Clean completion, partial interruption, duplicate summary/item events, done-only items, and late stale events.
- Slopcode persistence-shaped `providerOptions` and native `providerMetadata` conversion paths.
- Explicit Codex versus public session route capability and request behavior.

## Verification

- `packages/llm`: full suite, 313 passed and 30 recording-gated tests skipped; typecheck passed.
- `packages/slopcode`: focused native session and provider transform suites, 287 passed; typecheck passed.
- `packages/core`: focused session runner/model suites, 230 passed; typecheck passed.
- `git diff --check` passed.

## Database Impact

None. No persistence columns, migrations, or stored metadata schemas were added or changed.

## Concerns

None known. The 30 skipped LLM tests are existing live/recording-gated cases; the replayed recording suite passed.
