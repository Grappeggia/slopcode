package dev.slopcode.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class RemoteJobNotificationTest {
  @Test
  fun notificationActionsMatchTheCurrentRemoteState() {
    val approval = state(RemoteJobStatus.WAITING_APPROVAL)
    val question = state(RemoteJobStatus.WAITING_QUESTION)
    val failed = state(RemoteJobStatus.FAILED)
    val revoked = state(RemoteJobStatus.COMPLETED)

    assertEquals(listOf("approve", "reject", "stop"), remoteJobNotificationActions(approval))
    assertEquals(listOf("answer", "stop"), remoteJobNotificationActions(question))
    assertEquals(listOf("retry"), remoteJobNotificationActions(failed))
    assertTrue(remoteJobNotificationActions(revoked).isEmpty())
    assertTrue(remoteJobNotificationActionAllowed(approval, RemoteJobAction.APPROVE))
    assertFalse(remoteJobNotificationActionAllowed(question, RemoteJobAction.APPROVE))
    assertFalse(remoteJobNotificationActionAllowed(revoked, RemoteJobAction.STOP))
    assertFalse(remoteJobNotificationActionAllowed(revoked, RemoteJobAction.RETRY))
  }

  @Test
  fun contradictoryApprovalTapsShareOneInteractionAndStableIdempotencyKey() {
    val job = state(RemoteJobStatus.WAITING_APPROVAL).copy(approval = JSONObject().put("id", "apr_1"))
    val gate = RemoteJobActionGate()
    val ready = CountDownLatch(1)
    val release = CountDownLatch(1)
    val executor = Executors.newFixedThreadPool(2)
    val calls = listOf(RemoteJobAction.APPROVE, RemoteJobAction.REJECT).map { action ->
      executor.submit<Int> {
        val lease = gate.acquire(job, action) ?: return@submit 0
        lease.use {
          ready.countDown()
          release.await(5, TimeUnit.SECONDS)
          1
        }
      }
    }

    assertTrue(ready.await(5, TimeUnit.SECONDS))
    release.countDown()
    assertEquals(1, calls.sumOf { it.get(5, TimeUnit.SECONDS) })
    assertEquals(remoteJobActionIdempotencyKey(job, RemoteJobAction.APPROVE), remoteJobActionIdempotencyKey(job, RemoteJobAction.APPROVE))
    assertFalse(remoteJobActionIdempotencyKey(job, RemoteJobAction.APPROVE) == remoteJobActionIdempotencyKey(job, RemoteJobAction.REJECT))
    executor.shutdownNow()
  }

  @Test
  fun failedStopRemainsActionableInsteadOfPretendingTheJobStopped() {
    val failed = remoteJobActionFailure(state(RemoteJobStatus.RUNNING), RemoteJobAction.STOP, "The remote stop request failed")

    assertEquals(RemoteJobStatus.RUNNING, failed.status)
    assertEquals(RemoteJobAction.STOP, failed.retryAction)
    assertTrue(failed.actionError.orEmpty().contains("retry", ignoreCase = true))
    assertTrue(remoteJobNotificationActionAllowed(failed, RemoteJobAction.STOP))
  }

  @Test
  fun actionCompletionCannotOverwriteARevokedInteraction() {
    val approval = state(RemoteJobStatus.WAITING_APPROVAL).copy(
      approval = JSONObject().put("id", "apr_1").put("revision", 1),
    )
    val interaction = remoteJobActionInteraction(approval)
    val revoked = approval.copy(status = RemoteJobStatus.REVOKED)

    assertTrue(remoteJobActionStillCurrent(approval, interaction, RemoteJobAction.APPROVE))
    assertFalse(remoteJobActionStillCurrent(revoked, interaction, RemoteJobAction.APPROVE))
  }

  private fun state(status: String) = RemoteJobState(
    id = "job_notification",
    serverUrl = "https://desktop.example.com",
    username = "slopcode",
    password = "secret",
    workspaceID = "wrk_remote",
    directory = "/home/marcos/temp",
    agent = "codex-cli",
    prompt = "run tests",
    config = JSONObject(),
    status = status,
    updatedAt = 1,
  )
}
