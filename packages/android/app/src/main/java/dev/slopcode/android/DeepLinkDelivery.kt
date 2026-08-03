package dev.slopcode.android

internal fun intentDeepLinks(data: String?, notificationHref: String?) = listOfNotNull(
  data?.takeIf(String::isNotBlank),
  notificationHref?.takeIf(String::isNotBlank),
).distinct().take(MAX_INTENT_LINKS)

private const val MAX_INTENT_LINKS = 2
