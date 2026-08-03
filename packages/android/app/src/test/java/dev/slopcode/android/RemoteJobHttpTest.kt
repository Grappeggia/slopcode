package dev.slopcode.android

import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteJobHttpTest {
  @Test
  fun notificationActionSendsTheStableInteractionScopedIdempotencyKey() {
    val server = MockWebServer()
    server.start()
    try {
      server.enqueue(MockResponse().setResponseCode(202))
      val job = RemoteJobState(
        id = "job_http",
        serverUrl = server.url("/").toString().trimEnd('/'),
        username = "slopcode",
        password = "secret",
        workspaceID = "wrk_remote",
        directory = "/home/agent/temp",
        agent = "codex-cli",
        prompt = "run tests",
        config = JSONObject(),
        status = RemoteJobStatus.WAITING_APPROVAL,
        approval = JSONObject().put("id", "apr_1").put("revision", 1),
      )

      assertTrue(RemoteJobHttp(OkHttpClient()).action(job, RemoteJobAction.APPROVE))
      val request = server.takeRequest()
      val body = JSONObject(request.body.readUtf8())
      val key = remoteJobActionIdempotencyKey(job, RemoteJobAction.APPROVE)
      assertEquals(key, request.getHeader("Idempotency-Key"))
      assertEquals("approve", body.getString("action"))
      assertEquals("apr_1", body.getString("interactionID"))
      assertEquals(1, body.getInt("expectedRevision"))
      assertEquals(key, body.getString("idempotencyKey"))
    } finally {
      server.shutdown()
    }
  }
}
