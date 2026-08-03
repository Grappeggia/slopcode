package dev.slopcode.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteJobModelsTest {
  @Test
  fun processDeathStateRoundTripsWithCursorAndSecret() {
    val original = state(
      status = RemoteJobStatus.WAITING_APPROVAL,
      sessionID = "ses_123",
      cursor = "evt_12",
      output = "partial output",
      approval = JSONObject().put("title", "approve file write"),
      seen = listOf("evt_10", "evt_11", "evt_12"),
    )

    val restored = RemoteJobState.parse(original.toJson(includeSecret = true))

    assertNotNull(restored)
    assertEquals(original.id, restored?.id)
    assertEquals(original.status, restored?.status)
    assertEquals(original.sessionID, restored?.sessionID)
    assertEquals(original.cursor, restored?.cursor)
    assertEquals(original.output, restored?.output)
    assertEquals(original.approval?.toString(), restored?.approval?.toString())
    assertEquals(original.seen, restored?.seen)
    assertEquals(original.config?.toString(), restored?.config?.toString())
    assertEquals("secret", restored?.password)
  }

  @Test
  fun offlineReconnectResumesFromCursorAndIgnoresDuplicateEvent() {
    val original = state(cursor = "evt_1", output = "before")
    val event = RemoteJobEvent.parse(
      JSONObject()
        .put("id", "evt_2")
        .put("cursor", "evt_2")
        .put("jobID", original.id)
        .put("type", "job.progress")
        .put("data", JSONObject().put("output", " after").put("progress", 0.5)),
    )

    assertNotNull(event)
    val resumed = RemoteJobReducer.apply(original, event!!)
    val duplicate = RemoteJobReducer.apply(resumed, event)

    assertEquals("evt_2", resumed.cursor)
    assertEquals("before after", resumed.output)
    assertEquals(0.5, resumed.progress ?: -1.0, 0.0)
    assertEquals(resumed, duplicate)
  }

  @Test
  fun duplicateEventIdIsIgnoredAfterCursorIsPersisted() {
    val original = state(cursor = "evt_5")
    val event = RemoteJobEvent.parse(
      JSONObject()
        .put("id", "evt_5")
        .put("jobID", original.id)
        .put("type", "job.completed")
        .put("data", JSONObject().put("output", "duplicate")),
    )

    assertNotNull(event)
    assertEquals(original, RemoteJobReducer.apply(original, event!!))
  }

  @Test
  fun replayedEventIdsAndCursorsStayRejectedAfterNewerEventsAndRetriesRemainValid() {
    val first = RemoteJobReducer.apply(
      state(),
      RemoteJobEvent.parse(
        JSONObject().put("id", "evt_first").put("cursor", "cur_first").put("jobID", "job_test")
          .put("type", "job.stopped").put("data", JSONObject()),
      )!!,
    )
    val retried = RemoteJobReducer.apply(
      first,
      RemoteJobEvent.parse(
        JSONObject().put("id", "evt_retry").put("cursor", "cur_retry").put("jobID", "job_test")
          .put("type", "job.retry").put("data", JSONObject()),
      )!!,
    )
    val replayed = RemoteJobReducer.apply(
      retried,
      RemoteJobEvent.parse(
        JSONObject().put("id", "evt_first").put("cursor", "cur_replay").put("jobID", "job_test")
          .put("type", "job.progress").put("data", JSONObject().put("output", "replayed")),
      )!!,
    )

    assertEquals(RemoteJobStatus.RETRYING, retried.status)
    assertEquals(retried, replayed)
  }

  @Test
  fun notificationActionsAreAllowlisted() {
    assertTrue(RemoteJobAction.valid(RemoteJobAction.APPROVE))
    assertTrue(RemoteJobAction.valid(RemoteJobAction.REJECT))
    assertTrue(RemoteJobAction.valid(RemoteJobAction.ANSWER))
    assertTrue(RemoteJobAction.valid(RemoteJobAction.STEER))
    assertTrue(RemoteJobAction.valid(RemoteJobAction.COMMENT))
    assertTrue(RemoteJobAction.valid(RemoteJobAction.STOP))
    assertTrue(RemoteJobAction.valid(RemoteJobAction.RETRY))
    assertFalse(RemoteJobAction.valid("approve; rm -rf /"))
    assertFalse(RemoteJobAction.valid("open"))
  }

  @Test
  fun invalidPersistedStateFailsClosed() {
    val value = state().toJson(includeSecret = true)
      .put("directory", "/private/../etc")

    assertNull(RemoteJobState.parse(value))
    assertFalse(safeDirectory("/private/../etc"))
    assertTrue(safeDirectory("/Users/marcos/project"))
  }

  @Test
  fun remoteJobSpecRejectsInsecureOrMalformedInputs() {
    val valid = JSONObject()
      .put("serverUrl", "https://desktop.example.com")
      .put("username", "mac-user")
      .put("password", "secret")
      .put("workspaceID", "wrk_remote")
      .put("directory", "/Users/marcos/project")
      .put("agent", "codex-cli")
      .put("prompt", "run tests")

    assertNotNull(RemoteJobSpec.parse(valid.toString()))
    assertNull(RemoteJobSpec.parse(valid.put("serverUrl", "http://desktop.example.com").toString()))
    assertNull(RemoteJobSpec.parse(valid.put("serverUrl", "https://desktop.example.com").put("directory", "/tmp/../etc").toString()))
  }

  private fun state(
    status: String = RemoteJobStatus.RUNNING,
    sessionID: String? = null,
    cursor: String? = null,
    output: String? = null,
    approval: JSONObject? = null,
    seen: List<String> = emptyList(),
  ) = RemoteJobState(
    id = "job_test",
    serverUrl = "https://desktop.example.com",
    username = "mac-user",
    password = "secret",
    workspaceID = "wrk_remote",
    directory = "/Users/marcos/project",
    agent = "codex-cli",
    prompt = "run tests",
    config = JSONObject().put("model", "gpt-5"),
    status = status,
    sessionID = sessionID,
    cursor = cursor,
    output = output,
    approval = approval,
    seen = seen,
    updatedAt = 1_700_000_000_000,
  )
}
