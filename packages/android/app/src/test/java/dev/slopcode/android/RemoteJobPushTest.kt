package dev.slopcode.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RemoteJobPushTest {
  @Test
  fun fcmPayloadWakesItsExactJobWithoutAdvancingTheReplayCursor() {
    val wake = remoteJobPushWake(mapOf("job_id" to "job_push", "cursor" to "evt_42"))

    assertEquals("job_push", wake.jobID)
    assertEquals("evt_42", wake.cursor)
  }

  @Test
  fun malformedFcmCursorCannotAdvanceReplay() {
    assertNull(remoteJobPushWake(mapOf("jobID" to "job_push", "cursor" to "evt\n42")).cursor)
  }
}
