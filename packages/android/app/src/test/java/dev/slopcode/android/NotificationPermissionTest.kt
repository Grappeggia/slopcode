package dev.slopcode.android

import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationPermissionTest {
  @Test
  fun grantDenyAndUpgradeStatesRemainExplicit() {
    assertEquals("granted", state(api = 33, granted = true, enabled = true))
    assertEquals("denied", state(api = 33, denied = true))
    assertEquals("prompt", state(api = 33))
    assertEquals("denied", state(api = 33, observedApi = 32, observedPermission = "denied", enabled = false))
  }

  @Test
  fun preAndroid13UsesSystemNotificationEnablement() {
    assertEquals("granted", state(api = 32, enabled = true))
    assertEquals("denied", state(api = 32, enabled = false))
  }

  private fun state(
    api: Int,
    observedApi: Int? = null,
    observedPermission: String? = null,
    granted: Boolean = false,
    enabled: Boolean = false,
    denied: Boolean = false,
  ) = notificationPermissionState(
    NotificationPermissionFacts(api, observedApi, observedPermission, granted, enabled, rationale = false, denied),
  )
}
