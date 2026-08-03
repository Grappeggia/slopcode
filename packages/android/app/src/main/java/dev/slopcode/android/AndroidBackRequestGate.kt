package dev.slopcode.android

internal class AndroidBackRequestGate {
  private var value = 0L

  fun next() = ++value

  fun active(request: Long) = request == value

  fun invalidate() {
    value += 1
  }
}
