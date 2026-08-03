package dev.slopcode.android

internal fun intentDeepLinks(data: String?, notificationHref: String?) = listOfNotNull(
  data?.takeIf(String::isNotBlank),
  notificationHref?.takeIf(String::isNotBlank),
).distinct().take(MAX_INTENT_LINKS)

internal class DeepLinkDelivery(
  private val maxPending: Int = MAX_PENDING_LINKS,
  private val ttlMillis: Long = DEFAULT_TTL_MILLIS,
  private val maxHistory: Int = MAX_HISTORY_LINKS,
) {
  private val pending = ArrayDeque<String>()
  private val delivered = LinkedHashMap<String, Long>()

  fun restore(history: Map<String, Long>, queued: List<String> = emptyList(), now: Long = System.currentTimeMillis()) {
    pending.clear()
    delivered.clear()
    delivered.putAll(history)
    prune(now)
    queued.take(maxPending).forEach { value ->
      if (value.isNotBlank() && !delivered.containsKey(value) && !pending.contains(value)) pending.addLast(value)
    }
  }

  fun enqueue(value: String, now: Long = System.currentTimeMillis()): Boolean {
    prune(now)
    if (pending.contains(value) || delivered.containsKey(value)) return false
    while (pending.size >= maxPending) pending.removeFirst()
    pending.addLast(value)
    return true
  }

  fun consume(now: Long = System.currentTimeMillis()): List<String> {
    prune(now)
    val values = pending.toList()
    pending.clear()
    values.forEach { delivered[it] = now }
    prune(now)
    return values
  }

  fun peek(now: Long = System.currentTimeMillis()): List<String> {
    prune(now)
    return pending.toList()
  }

  fun requeue(values: List<String>, now: Long = System.currentTimeMillis()) {
    prune(now)
    values.asReversed().forEach { value ->
      if (pending.contains(value)) return@forEach
      delivered.remove(value)
      while (pending.size >= maxPending) pending.removeLast()
      pending.addFirst(value)
    }
  }

  fun history(now: Long = System.currentTimeMillis()): Map<String, Long> {
    prune(now)
    return delivered.toMap()
  }

  private fun prune(now: Long) {
    delivered.entries.removeIf { (_, timestamp) -> now - timestamp >= ttlMillis }
    while (delivered.size > maxHistory) delivered.entries.iterator().apply { next(); remove() }
  }

  companion object {
    private const val MAX_PENDING_LINKS = 2
    private const val MAX_HISTORY_LINKS = 64
    private const val DEFAULT_TTL_MILLIS = 10 * 60 * 1_000L
  }
}

private const val MAX_INTENT_LINKS = 2
