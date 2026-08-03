package dev.slopcode.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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

  @Test
  fun sequentialDuplicateTapIsSuppressedAfterTheFirstLinkIsConsumed() {
    val href = "slopcode://remote-session?job=job_approval&session=ses_pending"
    val delivery = DeepLinkDelivery(maxPending = 2, ttlMillis = 1_000)

    assertTrue(delivery.enqueue(href, now = 10))
    assertEquals(listOf(href), delivery.consume(now = 10))
    assertFalse(delivery.enqueue(href, now = 11))
    assertTrue(delivery.enqueue(href, now = 1_011))
  }

  @Test
  fun rendererRetryRequeuesAConsumedLinkWithoutAllowingAnotherPendingCopy() {
    val href = "slopcode://remote-session?job=job_retry"
    val delivery = DeepLinkDelivery(maxPending = 2, ttlMillis = 1_000)

    delivery.enqueue(href, now = 10)
    val consumed = delivery.consume(now = 10)
    delivery.requeue(consumed, now = 10)
    assertEquals(listOf(href), delivery.consume(now = 10))
    assertFalse(delivery.enqueue(href, now = 11))
  }

  @Test
  fun pendingLinkCanBeRestoredWhenTheProcessDiesBeforeRendererAcknowledgesIt() {
    val href = "slopcode://remote-session?job=job_crash_safe"
    val delivery = DeepLinkDelivery(maxPending = 2, ttlMillis = 1_000)

    assertTrue(delivery.enqueue(href, now = 10))
    assertEquals(listOf(href), delivery.peek(now = 10))

    val restored = DeepLinkDelivery(maxPending = 2, ttlMillis = 1_000)
    restored.restore(emptyMap(), listOf(href), now = 11)
    assertEquals(listOf(href), restored.consume(now = 11))
  }

  @Test
  fun deliveredHistoryIsBounded() {
    val delivery = DeepLinkDelivery(maxPending = 2, ttlMillis = 10_000)

    (0..80).forEach { index ->
      val href = "slopcode://remote-session?job=job_$index"
      delivery.enqueue(href, now = index.toLong())
      delivery.consume(now = index.toLong())
    }

    assertEquals(64, delivery.history(now = 100).size)
  }
}
