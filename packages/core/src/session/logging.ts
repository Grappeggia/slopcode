import { Cause, Effect } from "effect"
import { SessionSchema } from "./schema"
import { SessionProviderRetry } from "./provider-retry"

export const logFailure = (
  message: "Failed to drain Session" | "Failed to wake Session",
  sessionID: SessionSchema.ID,
  cause: Cause.Cause<unknown>,
) =>
  Effect.logError(message, Cause.fail(SessionProviderRetry.sanitize(Cause.pretty(cause)))).pipe(
    Effect.annotateLogs({ sessionID }),
  )
