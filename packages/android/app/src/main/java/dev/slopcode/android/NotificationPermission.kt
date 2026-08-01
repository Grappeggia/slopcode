package dev.slopcode.android

internal data class NotificationPermissionFacts(
  val api: Int,
  val observedApi: Int?,
  val observedPermission: String?,
  val granted: Boolean,
  val enabled: Boolean,
  val rationale: Boolean,
  val denied: Boolean,
)

internal fun notificationPermissionState(facts: NotificationPermissionFacts): String {
  if (facts.api < ANDROID_13) return if (facts.enabled) "granted" else "denied"
  if (facts.granted && facts.enabled) return "granted"
  if (facts.denied || facts.rationale) return "denied"

  val upgradedFromDisabled = facts.observedApi != null && facts.observedApi < ANDROID_13 &&
    (facts.observedPermission == "denied" || !facts.enabled)
  if (upgradedFromDisabled) return "denied"
  if (facts.granted) return "denied"
  return "prompt"
}

private const val ANDROID_13 = 33
