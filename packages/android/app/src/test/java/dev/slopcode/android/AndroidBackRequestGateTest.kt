package dev.slopcode.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidBackRequestGateTest {
  @Test
  fun onlyTheLatestBackCallbackCanActAndDestroyedActivitiesInvalidateAllCallbacks() {
    val gate = AndroidBackRequestGate()
    val first = gate.next()
    val second = gate.next()

    assertFalse(gate.active(first))
    assertTrue(gate.active(second))
    gate.invalidate()
    assertFalse(gate.active(second))
  }
}
