package dev.slopcode.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class SshConnectGenerationTest {
  @Test
  fun queuedConnectCancelledBeforeItStartsDoesNotBeginTheNativeAttempt() {
    val gate = SshConnectGeneration()
    val executor = Executors.newSingleThreadExecutor()
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val done = CountDownLatch(1)
    val connected = AtomicBoolean(false)
    executor.execute {
      entered.countDown()
      release.await()
    }
    assertTrue(entered.await(1, TimeUnit.SECONDS))

    val attempt = gate.reserve()
    executor.execute {
      try {
        if (gate.begin(attempt)) connected.set(true)
      } finally {
        gate.finish(attempt)
        done.countDown()
      }
    }

    gate.cancel()

    release.countDown()
    assertTrue(done.await(1, TimeUnit.SECONDS))
    assertFalse(connected.get())
    executor.shutdownNow()
  }
}
