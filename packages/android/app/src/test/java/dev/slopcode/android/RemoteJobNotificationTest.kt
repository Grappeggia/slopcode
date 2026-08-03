package dev.slopcode.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

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

  private fun state(status: String) = RemoteJobState(
    id = "job_notification",
    serverUrl = "https://desktop.example.com",
    username = "slopcode",
    password = "secret",
    workspaceID = "wrk_remote",
    directory = "/home/agent/temp",
    agent = "codex-cli",
    prompt = "run tests",
    config = JSONObject(),
    status = status,
    updatedAt = 1,
  )
}
