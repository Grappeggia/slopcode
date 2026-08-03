package dev.slopcode.android

internal class SshConnectGeneration {
  private var value = 0L
  private var current: Long? = null

  fun reserve(): Long {
    value += 1
    current = value
    return value
  }

  fun cancel() {
    current = null
  }

  fun begin(attempt: Long) = current == attempt

  fun finish(attempt: Long) {
    if (current == attempt) current = null
  }
}
