package dev.slopcode.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList

class AndroidBridge(
  private val context: Context,
  private val webView: WebView,
) {
  private val deepLinks = CopyOnWriteArrayList<String>()
  private val channelId = "slopcode.android"
  private val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()

  init {
    val channel = NotificationChannel(channelId, "SlopCode", NotificationManager.IMPORTANCE_DEFAULT)
    manager.createNotificationChannel(channel)
  }

  private fun prefs(namespace: String) = EncryptedSharedPreferences.create(
    context,
    "slopcode.$namespace",
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  private fun permissionState(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted"
    return if (context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
      "granted"
    else
      "prompt"
  }

  private fun errorJson(payload: String?, code: String, message: String, retryable: Boolean): String {
    val requestID = payload?.let {
      runCatching { JSONObject(it).optString("id") }.getOrNull()?.takeIf { value -> value.isNotBlank() }
    }
    return JSONObject().apply {
      put("version", "v1")
      put("kind", "error")
      if (requestID != null) put("requestID", requestID)
      put("code", code)
      put("message", message)
      put("retryable", retryable)
    }.toString()
  }

  fun enqueueDeepLink(url: String) {
    if (url.isBlank()) return
    deepLinks += url
  }

  fun flushDeepLinks() {
    val urls = consumeLinks()
    if (urls.isEmpty()) return
    val payload = JSONArray(urls).toString().replace("\\", "\\\\").replace("'", "\\'")
    webView.post {
      webView.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('slopcode:android-deep-link', { detail: { urls: JSON.parse('$payload') } }))",
        null,
      )
    }
  }

  private fun consumeLinks(): List<String> {
    val urls = deepLinks.toList()
    deepLinks.clear()
    return urls
  }

  @JavascriptInterface
  fun capabilities(): String =
    JSONObject()
      .put("secureStorage", true)
      .put("qrPairing", false)
      .put("notifications", true)
      .put("deepLinks", true)
      .put("remoteTransport", BuildConfig.SLOPCODE_REMOTE_BASE_URL.isNotBlank())
      .toString()

  @JavascriptInterface
  fun storageGet(namespace: String, key: String): String? = prefs(namespace).getString(key, null)

  @JavascriptInterface
  fun storageSet(namespace: String, key: String, value: String) {
    prefs(namespace).edit().putString(key, value).apply()
  }

  @JavascriptInterface
  fun storageRemove(namespace: String, key: String) {
    prefs(namespace).edit().remove(key).apply()
  }

  @JavascriptInterface
  fun storageClear(namespace: String) {
    prefs(namespace).edit().clear().apply()
  }

  @JavascriptInterface
  fun storageKeys(namespace: String): String = JSONArray(prefs(namespace).all.keys.toList()).toString()

  @JavascriptInterface
  fun storageLength(namespace: String): Int = prefs(namespace).all.size

  @JavascriptInterface
  fun scanQrPairing(): String? = null

  @JavascriptInterface
  fun notificationPermission(): String = permissionState()

  @JavascriptInterface
  fun requestNotificationPermission(): String = permissionState()

  @JavascriptInterface
  fun showNotification(title: String, description: String?, href: String?) {
    if (permissionState() != "granted") return

    val intent = Intent(context, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      if (!href.isNullOrBlank()) putExtra("notification_href", href)
    }
    val pending = PendingIntent.getActivity(
      context,
      href?.hashCode() ?: title.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, channelId)
      .setContentTitle(title)
      .setContentText(description ?: "")
      .setSmallIcon(android.R.drawable.stat_notify_more)
      .setAutoCancel(true)
      .setContentIntent(pending)
      .build()

    manager.notify((href ?: title).hashCode(), notification)
  }

  @JavascriptInterface
  fun consumeDeepLinks(): String = JSONArray(consumeLinks()).toString()

  @JavascriptInterface
  fun remoteSend(payload: String): String {
    val base = BuildConfig.SLOPCODE_REMOTE_BASE_URL.trim().trimEnd('/')
    if (base.isBlank()) return errorJson(payload, "remote_not_configured", "Remote transport is not configured", false)

    val connection = (URL("$base/api/remote").openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 10_000
      readTimeout = 20_000
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("Accept", "application/json")
    }

    return runCatching {
      connection.outputStream.use { stream ->
        stream.write(payload.toByteArray(Charsets.UTF_8))
      }
      val body = (if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()
        ?.use(BufferedReader::readText)
        ?.trim()
      if (!body.isNullOrBlank()) body else errorJson(payload, "remote_empty_response", "Remote transport returned no body", true)
    }.getOrElse { error ->
      errorJson(payload, "remote_request_failed", error.message ?: "Remote transport failed", true)
    }.also {
      connection.disconnect()
    }
  }

  @JavascriptInterface
  fun openLink(url: String) {
    val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
