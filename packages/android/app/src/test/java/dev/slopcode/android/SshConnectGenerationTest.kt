package dev.slopcode.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SshConnectGenerationTest {
  @Test
  fun cancelBeforeSessionPublicationStillInvalidatesThatConnectAttempt() {
    val gate = SshConnectGeneration()
    val attempt = gate.start()

    gate.cancel()

    assertFalse(gate.active(attempt))
    assertTrue(gate.active(gate.start()))
  }
}
