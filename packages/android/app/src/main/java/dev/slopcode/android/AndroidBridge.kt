package dev.slopcode.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

class AndroidBridge(
  private val activity: MainActivity,
  private val webView: WebView,
) {
  private val state = activity.getSharedPreferences("slopcode.permission", android.content.Context.MODE_PRIVATE)
  private val deepLinks = CopyOnWriteArrayList<String>()
  private val permission = CopyOnWriteArrayList<(String) -> Unit>()
  private val channelId = "slopcode.android"
  private val manager = activity.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as NotificationManager
  private val key = MasterKey.Builder(activity).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
  private val io = Executors.newSingleThreadExecutor()

  init {
    val channel = NotificationChannel(channelId, "SlopCode", NotificationManager.IMPORTANCE_DEFAULT)
    manager.createNotificationChannel(channel)
  }

  private fun prefs(namespace: String) = EncryptedSharedPreferences.create(
    activity,
    "slopcode.$namespace",
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  private fun notificationRequested() = state.getBoolean("notification_requested", false)

  @Suppress("DEPRECATION")
  private fun upgradedInstall() = runCatching {
    val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
    info.lastUpdateTime > info.firstInstallTime
  }.getOrDefault(false)

  private fun permissionState(granted: Boolean, requested: Boolean, rationale: Boolean, enabled: Boolean, upgraded: Boolean): String {
    if (granted) return "granted"
    if (requested || rationale) return "denied"
    if (!enabled && upgraded) return "denied"
    return "prompt"
  }

  private fun permissionState(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted"
    return permissionState(
      activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
      notificationRequested(),
      activity.shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS),
      NotificationManagerCompat.from(activity).areNotificationsEnabled(),
      // Android 13+ keeps notifications off for fresh installs until the first grant, so only
      // treat disabled notifications as an upgrade denial when this install has actually been updated.
      upgradedInstall(),
    )
  }

  private fun remoteBaseUrl(): URL? {
    val raw = BuildConfig.SLOPCODE_REMOTE_BASE_URL.trim()
    if (raw.isBlank()) return null
    val url = runCatching { URL(raw) }.getOrNull() ?: return null
    return url.takeIf { it.protocol == "https" }
  }

  private fun requestNotificationPermission(done: (String) -> Unit) {
    val state = permissionState()
    if (state == "granted" || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      done(state)
      return
    }

    webView.post {
      permission += done
      if (permission.size > 1) return@post
      activity.requestNotificationPermission()
    }
  }

  private fun requestId(payload: String?) =
    payload?.let {
      runCatching { JSONObject(it).optString("id") }.getOrNull()?.takeIf { value -> value.isNotBlank() }
    }

  private fun remoteError(payload: String?, code: String, message: String, retryable: Boolean): String =
    JSONObject().apply {
      put("version", "v1")
      put("kind", "error")
      requestId(payload)?.let { put("requestID", it) }
      put("code", code)
      put("message", message)
      put("retryable", retryable)
    }.toString()

  private fun bridgeError(id: String?, code: String, message: String) =
    JSONObject().apply {
      if (id != null) put("id", id)
      put("ok", false)
      put("code", code)
      put("message", message)
    }.toString()

  private fun bridgeResult(id: String, result: Any? = JSONObject.NULL) =
    JSONObject().apply {
      put("id", id)
      put("ok", true)
      put("result", result)
    }.toString()

  private fun reply(proxy: JavaScriptReplyProxy, payload: String) {
    webView.post {
      proxy.postMessage(payload)
    }
  }

  private fun request(message: String?): JSONObject? {
    if (message.isNullOrBlank()) return null
    return runCatching { JSONObject(message) }.getOrNull()
  }

  private fun argText(args: JSONArray, index: Int) = args.optString(index).takeIf(String::isNotBlank)

  private fun safeExternalUri(url: String): Uri? {
    val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return null
    val scheme = uri.scheme?.lowercase() ?: return null
    if (scheme !in setOf("https", "mailto", "tel")) return null
    if ((scheme == "https") && uri.host.isNullOrBlank()) return null
    return uri
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
        """
        window.__SLOPCODE__ = window.__SLOPCODE__ || {};
        window.__SLOPCODE__.deepLinks = [...(window.__SLOPCODE__.deepLinks || []), ...JSON.parse('$payload')];
        window.dispatchEvent(new CustomEvent('slopcode:deep-link', { detail: { urls: JSON.parse('$payload') } }));
        """.trimIndent(),
        null,
      )
    }
  }

  private fun consumeLinks(): List<String> {
    val urls = deepLinks.toList()
    deepLinks.clear()
    return urls
  }

  private fun capabilities() =
    JSONObject()
      .put("secureStorage", true)
      .put("qrPairing", false)
      .put("notifications", true)
      .put("deepLinks", true)
      .put("remoteTransport", remoteBaseUrl() != null)

  fun listener() = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, replyProxy ->
    if (!isMainFrame || sourceOrigin.scheme != "https" || sourceOrigin.host != TRUSTED_HOST) {
      reply(replyProxy, bridgeError(null, "untrusted_origin", "Bridge calls require the trusted local app origin"))
      return@WebMessageListener
    }

    val request = request(message.data)
    val id = request?.optString("id")?.takeIf(String::isNotBlank)
    val method = request?.optString("method")?.takeIf(String::isNotBlank)
    if (id == null || method == null) {
      reply(replyProxy, bridgeError(id, "invalid_request", "Malformed bridge request"))
      return@WebMessageListener
    }

    val args = request.optJSONArray("args") ?: JSONArray()
    when (method) {
      "capabilities" -> reply(replyProxy, bridgeResult(id, capabilities()))
      "storageGet" -> reply(replyProxy, bridgeResult(id, prefs(argText(args, 0) ?: "").getString(argText(args, 1) ?: "", null)))
      "storageSet" -> {
        prefs(argText(args, 0) ?: "").edit().putString(argText(args, 1) ?: "", argText(args, 2) ?: "").apply()
        reply(replyProxy, bridgeResult(id))
      }
      "storageRemove" -> {
        prefs(argText(args, 0) ?: "").edit().remove(argText(args, 1) ?: "").apply()
        reply(replyProxy, bridgeResult(id))
      }
      "storageClear" -> {
        prefs(argText(args, 0) ?: "").edit().clear().apply()
        reply(replyProxy, bridgeResult(id))
      }
      "storageKeys" -> reply(replyProxy, bridgeResult(id, JSONArray(prefs(argText(args, 0) ?: "").all.keys.toList())))
      "storageLength" -> reply(replyProxy, bridgeResult(id, prefs(argText(args, 0) ?: "").all.size))
      "scanQrPairing" -> reply(replyProxy, bridgeResult(id, JSONObject.NULL))
      "notificationPermission" -> reply(replyProxy, bridgeResult(id, permissionState()))
      "requestNotificationPermission" -> requestNotificationPermission { state ->
        reply(replyProxy, bridgeResult(id, state))
      }
      "showNotification" -> {
        showNotification(argText(args, 0) ?: "", argText(args, 1), argText(args, 2))
        reply(replyProxy, bridgeResult(id))
      }
      "consumeDeepLinks" -> reply(replyProxy, bridgeResult(id, JSONArray(consumeLinks())))
      "remoteSend" -> {
        val payload = argText(args, 0) ?: ""
        io.execute {
          reply(replyProxy, bridgeResult(id, remoteSend(payload)))
        }
      }
      "openLink" -> reply(replyProxy, bridgeResult(id, openLink(argText(args, 0) ?: "")))
      else -> reply(replyProxy, bridgeError(id, "unknown_method", "Unsupported bridge method"))
    }
  }

  fun showNotification(title: String, description: String?, href: String?) {
    if (permissionState() != "granted") return

    val intent = Intent(activity, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      if (!href.isNullOrBlank()) putExtra("notification_href", href)
    }
    val pending = PendingIntent.getActivity(
      activity,
      href?.hashCode() ?: title.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(activity, channelId)
      .setContentTitle(title)
      .setContentText(description ?: "")
      .setSmallIcon(android.R.drawable.stat_notify_more)
      .setAutoCancel(true)
      .setContentIntent(pending)
      .build()

    manager.notify((href ?: title).hashCode(), notification)
  }

  fun remoteSend(payload: String): String {
    val base = remoteBaseUrl()?.toString()?.trimEnd('/')
      ?: return remoteError(payload, "remote_not_configured", "Remote transport is not configured for HTTPS", false)

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
      if (!body.isNullOrBlank()) body else remoteError(payload, "remote_empty_response", "Remote transport returned no body", true)
    }.getOrElse { error ->
      remoteError(payload, "remote_request_failed", error.message ?: "Remote transport failed", true)
    }.also {
      connection.disconnect()
    }
  }

  fun openLink(url: String): Boolean {
    val uri = safeExternalUri(url) ?: return false
    val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return runCatching {
      activity.startActivity(intent)
      true
    }.getOrDefault(false)
  }

  fun onNotificationPermissionResult(granted: Boolean) {
    state.edit().putBoolean("notification_requested", true).apply()
    val state = if (granted) "granted" else "denied"
    val callbacks = permission.toList()
    permission.clear()
    callbacks.forEach { it(state) }
  }

  companion object {
    private const val TRUSTED_HOST = "appassets.androidplatform.net"
  }
}
