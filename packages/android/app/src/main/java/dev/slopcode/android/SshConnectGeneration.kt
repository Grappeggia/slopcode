package dev.slopcode.android

internal class SshConnectGeneration {
  private var value = 0L

  fun start() = ++value

  fun cancel() {
    value += 1
  }

  fun active(attempt: Long) = attempt == value
}
