package dev.slopcode.android

import org.junit.Assert.assertEquals
import org.junit.Test

class DeepLinkDeliveryTest {
  @Test
  fun duplicateNotificationTapDeliversOneExactSessionLink() {
    val href = "slopcode://remote-session?job=job_approval&session=ses_pending"

    assertEquals(listOf(href), intentDeepLinks(href, href))
  }

  @Test
  fun notificationHrefRetainsPendingApprovalSessionWhenIntentDataIsAbsent() {
    val href = "slopcode://remote-session?job=job_approval&session=ses_pending"

    assertEquals(listOf(href), intentDeepLinks(null, href))
  }
}
