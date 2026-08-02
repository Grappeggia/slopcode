export async function stopServices(tasks: Promise<void>[], finish: () => void) {
  const results = await Promise.allSettled(tasks)
  finish()
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
  if (failures.length === 1) throw failures[0].reason
  if (failures.length > 1)
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "Sidecar cleanup failed",
    )
}
