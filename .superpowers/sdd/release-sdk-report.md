# JavaScript SDK Release Report

Status: DONE

## Generated Artifacts

- Regenerated with `./packages/sdk/js/script/build.ts` from the current server/OpenAPI contracts.
- Updated only `packages/sdk/js/src/v2/gen/sdk.gen.ts` and `packages/sdk/js/src/v2/gen/types.gen.ts`.
- A second generation run produced the identical diff SHA-256: `6ebacd41e064d29c5884a0a7be9021d9bdff69052eb678a34ff267c86008211c`.
- No generated files were manually edited.

## Contract Verification

- `Session3.compact` accepts `sessionID` plus the generated `{ id?, prompt? }` JSON body and emits `Content-Type: application/json`.
- `V2SessionCompactErrors` exposes `400`, `404`, `409`, and `500`; it does not expose the obsolete `503` response.
- `V2SessionWaitErrors` exposes `404` and `500`; it does not expose the obsolete `503` response.
- Broader generated type updates reflect the current OpenAPI schema and remain confined to the two generator-owned output files.

## Verification

- `bun install --frozen-lockfile`: passed.
- `./packages/sdk/js/script/build.ts`: passed twice; generation, formatting, and TypeScript compilation completed.
- `bun run typecheck` in `packages/sdk/js`: passed.
- `bun test test/server/httpapi-public-openapi.test.ts` in `packages/slopcode`: 17 passed, 0 failed.
- `git diff --check`: passed.

## Concerns

None.
