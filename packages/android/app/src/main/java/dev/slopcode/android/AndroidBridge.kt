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
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList

class AndroidBridge(
  private val activity: MainActivity,
  private val webView: WebView,
) {
  private val notificationState = activity.getSharedPreferences("slopcode.permission", android.content.Context.MODE_PRIVATE)
  private val deepLinks = CopyOnWriteArrayList<String>()
  private val permission = CopyOnWriteArrayList<(String) -> Unit>()
  private val storageLock = Any()
  private val channelId = "slopcode.android"
  private val manager = activity.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as NotificationManager
  private val key = MasterKey.Builder(activity).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
  @Volatile private var rendererReady = false
  @Volatile private var rendererNonce: String? = null

  init {
    val channel = NotificationChannel(channelId, "SlopCode", NotificationManager.IMPORTANCE_DEFAULT)
    manager.createNotificationChannel(channel)
    permissionState()
  }

  private fun prefs(namespace: String) = EncryptedSharedPreferences.create(
    activity,
    "slopcode.$namespace",
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  private fun permissionState(): String {
    val observedApi = notificationState.getInt("notification_observed_api", -1).takeIf { it >= 0 }
    val observedPermission = notificationState.getString("notification_observed_permission", null)
    val enabled = NotificationManagerCompat.from(activity).areNotificationsEnabled()
    val next = notificationPermissionState(
      NotificationPermissionFacts(
        api = Build.VERSION.SDK_INT,
        observedApi = observedApi,
        observedPermission = observedPermission,
        granted = activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
        enabled = enabled,
        rationale = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
          activity.shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS),
        denied = notificationState.getBoolean("notification_denied", false),
      ),
    )
    notificationState.edit()
      .putInt("notification_observed_api", Build.VERSION.SDK_INT)
      .putString("notification_observed_permission", next)
      .putBoolean("notification_denied", next == "denied")
      .apply()
    return next
  }

  private fun requestNotificationPermission(done: (String) -> Unit) {
    val state = permissionState()
    if (state != "prompt" || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      done(state)
      return
    }

    webView.post {
      val current = permissionState()
      if (current != "prompt") {
        done(current)
        return@post
      }
      permission += done
      if (permission.size > 1) return@post
      activity.requestNotificationPermission()
    }
  }

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
    if (message.isNullOrBlank() || message.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_BYTES) return null
    return runCatching { JSONObject(message) }.getOrNull()
  }

  private fun argText(args: JSONArray, index: Int, limit: Int, required: Boolean = true): String? {
    val value = args.opt(index) as? String ?: return null
    if (value.toByteArray(Charsets.UTF_8).size > limit) return null
    if (value.any { it == '\u0000' || it == '\r' || it == '\n' }) return null
    if (required && value.isBlank()) return null
    return value
  }

  private fun requestText(request: JSONObject, name: String, limit: Int): String? {
    val value = request.opt(name) as? String ?: return null
    if (value.toByteArray(Charsets.UTF_8).size > limit) return null
    if (value.isBlank() || value.any { it == '\u0000' || it == '\r' || it == '\n' }) return null
    return value
  }

  private fun arity(args: JSONArray, min: Int, max: Int = min) {
    check(args.length() in min..max) { "Invalid bridge argument count" }
  }

  private fun namespace(args: JSONArray, index: Int): String {
    val value = argText(args, index, MAX_NAMESPACE_BYTES) ?: error("Invalid storage namespace")
    check(allowedNamespace(value)) { "Storage namespace is not allowed" }
    return value
  }

  private fun storageKey(args: JSONArray, index: Int): String =
    argText(args, index, MAX_KEY_BYTES) ?: error("Invalid storage key")

  private fun storageValue(args: JSONArray, index: Int): String =
    argText(args, index, MAX_VALUE_BYTES) ?: error("Invalid storage value")

  private fun deepLinkNonce(args: JSONArray, index: Int): String {
    val value = argText(args, index, MAX_NONCE_BYTES) ?: error("Invalid deep-link nonce")
    check(value.matches(Regex("[A-Za-z0-9_-]{16,128}"))) { "Invalid deep-link nonce" }
    return value
  }

  private fun allowedNamespace(value: String) =
    value == "default.dat" ||
      value == "slopcode.global.dat" ||
      value == "slopcode.android.app.dat" ||
      value == "slopcode.android.remote.dat" ||
      value.matches(Regex("slopcode\\.(workspace|draft)\\.[a-zA-Z0-9._-]{1,12}\\.[a-zA-Z0-9_-]{1,64}\\.dat"))

  private fun preferences(namespace: String) =
    runCatching { prefs(namespace) }.getOrElse { error("Native storage is unavailable") }

  private fun safeExternalUri(url: String): Uri? {
    if (url.toByteArray(Charsets.UTF_8).size > MAX_URL_BYTES) return null
    val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return null
    val scheme = uri.scheme?.lowercase() ?: return null
    if (scheme !in setOf("https", "mailto", "tel")) return null
    if ((scheme == "https") && uri.host.isNullOrBlank()) return null
    return uri
  }

  private fun safeDeepLink(url: String): String? {
    if (url.toByteArray(Charsets.UTF_8).size > MAX_URL_BYTES) return null
    val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return null
    if (uri.scheme != "slopcode" || uri.userInfo != null || uri.fragment != null) return null
    if (uri.port != -1 || (uri.path != null && uri.path != "" && uri.path != "/")) return null
    val host = uri.host ?: return null
    if (host != "open-project" && host != "new-session") return null
    val directories = uri.getQueryParameters("directory")
    val directory = directories.singleOrNull() ?: return null
    if (directory.isBlank() || directory.length > MAX_DIRECTORY_CHARS || !directory.startsWith("/") || directory.contains("\\") || directory.contains("\u0000") || directory.contains("//")) return null
    if (directory.split("/").any { it == "." || it == ".." }) return null
    val allowed = if (host == "new-session") setOf("directory", "prompt") else setOf("directory")
    if (uri.queryParameterNames.any { it !in allowed }) return null
    if (host == "new-session" && uri.getQueryParameters("prompt").size > 1) return null
    val prompt = uri.getQueryParameter("prompt")
    if (prompt != null && (prompt.length > MAX_PROMPT_CHARS || prompt.any { it == '\u0000' || it == '\r' || it == '\n' })) return null
    return url
  }

  fun enqueueDeepLink(url: String) {
    val value = safeDeepLink(url) ?: return
    synchronized(deepLinks) {
      while (deepLinks.size >= MAX_DEEP_LINKS) deepLinks.removeAt(0)
      deepLinks += value
    }
  }

  fun onRendererNavigation() {
    rendererReady = false
    rendererNonce = null
  }

  fun flushDeepLinks() {
    if (!rendererReady) return
    val nonce = rendererNonce ?: return
    val urls = consumeLinks()
    if (urls.isEmpty()) return
    val payload = JSONObject()
      .put("type", "slopcode.deep-links")
      .put("channel", DEEP_LINK_CHANNEL)
      .put("nonce", nonce)
      .put("ready", true)
      .put("urls", JSONArray(urls))
      .toString()
    webView.post {
      if (!rendererReady || rendererNonce != nonce) {
        synchronized(deepLinks) {
          urls.forEach { deepLinks.add(0, it) }
        }
        return@post
      }
      WebViewCompat.postWebMessage(webView, WebMessageCompat(payload), Uri.parse(TRUSTED_ORIGIN))
    }
  }

  private fun consumeLinks(): List<String> = synchronized(deepLinks) {
    val urls = deepLinks.toList()
    deepLinks.clear()
    urls
  }

  private fun capabilities() =
    JSONObject()
      .put("secureStorage", true)
      .put("qrPairing", false)
      .put("notifications", true)
      .put("deepLinks", true)
      .put("remoteTransport", false)

  fun listener() = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, replyProxy ->
    if (!isMainFrame || sourceOrigin.toString() != TRUSTED_ORIGIN) {
      reply(replyProxy, bridgeError(null, "untrusted_origin", "Bridge calls require the trusted local app origin"))
      return@WebMessageListener
    }

    val request = request(message.data)
    val id = request?.let { requestText(it, "id", MAX_ID_BYTES) }
    val method = request?.let { requestText(it, "method", MAX_METHOD_BYTES) }
    if (id == null || method == null) {
      reply(replyProxy, bridgeError(id, "invalid_request", "Malformed bridge request"))
      return@WebMessageListener
    }

    val args = request.optJSONArray("args") ?: JSONArray()
    if (request.has("args") && request.opt("args") !is JSONArray) {
      reply(replyProxy, bridgeError(id, "invalid_request", "Bridge args must be an array"))
      return@WebMessageListener
    }
    if (args.length() > MAX_ARGS) {
      reply(replyProxy, bridgeError(id, "invalid_request", "Too many bridge arguments"))
      return@WebMessageListener
    }
    runCatching {
      when (method) {
        "capabilities" -> {
          arity(args, 0)
          reply(replyProxy, bridgeResult(id, capabilities()))
        }
        "storageGet" -> {
          arity(args, 2)
          val value = synchronized(storageLock) {
            preferences(namespace(args, 0)).getString(storageKey(args, 1), null)
          }
          reply(replyProxy, bridgeResult(id, value))
        }
        "storageSet" -> {
          arity(args, 3)
          val saved = synchronized(storageLock) {
            preferences(namespace(args, 0)).edit().putString(storageKey(args, 1), storageValue(args, 2)).commit()
          }
          check(saved) { "Native storage write failed" }
          reply(replyProxy, bridgeResult(id))
        }
        "storageRemove" -> {
          arity(args, 2)
          val saved = synchronized(storageLock) {
            preferences(namespace(args, 0)).edit().remove(storageKey(args, 1)).commit()
          }
          check(saved) { "Native storage write failed" }
          reply(replyProxy, bridgeResult(id))
        }
        "storageClear" -> {
          arity(args, 1)
          val saved = synchronized(storageLock) {
            preferences(namespace(args, 0)).edit().clear().commit()
          }
          check(saved) { "Native storage write failed" }
          reply(replyProxy, bridgeResult(id))
        }
        "storageKeys" -> {
          arity(args, 1)
          val keys = synchronized(storageLock) {
            preferences(namespace(args, 0)).all.keys.filter { it.length <= MAX_KEY_BYTES }.take(MAX_STORAGE_KEYS)
          }
          reply(replyProxy, bridgeResult(id, JSONArray(keys)))
        }
        "storageLength" -> {
          arity(args, 1)
          val length = synchronized(storageLock) {
            preferences(namespace(args, 0)).all.size.coerceAtMost(MAX_STORAGE_KEYS)
          }
          reply(replyProxy, bridgeResult(id, length))
        }
        "scanQrPairing" -> {
          arity(args, 0)
          reply(replyProxy, bridgeResult(id, JSONObject.NULL))
        }
        "notificationPermission" -> {
          arity(args, 0)
          reply(replyProxy, bridgeResult(id, permissionState()))
        }
        "requestNotificationPermission" -> {
          arity(args, 0)
          requestNotificationPermission { state -> reply(replyProxy, bridgeResult(id, state)) }
        }
        "showNotification" -> {
          arity(args, 1, 3)
          val title = argText(args, 0, MAX_TEXT_BYTES) ?: error("Invalid notification title")
          val description = argText(args, 1, MAX_TEXT_BYTES, required = false)
          val href = argText(args, 2, MAX_URL_BYTES, required = false)?.let { safeExternalUri(it) ?: safeDeepLink(it) }
          showNotification(title, description, href?.toString())
          reply(replyProxy, bridgeResult(id))
        }
        "deepLinksReady" -> {
          arity(args, 1)
          rendererNonce = deepLinkNonce(args, 0)
          rendererReady = true
          reply(replyProxy, bridgeResult(id, true))
        }
        "consumeDeepLinks" -> {
          arity(args, 1)
          val nonce = deepLinkNonce(args, 0)
          check(rendererReady && rendererNonce == nonce) { "Renderer is not ready for deep links" }
          reply(replyProxy, bridgeResult(id, JSONArray(consumeLinks())))
        }
        "openLink" -> {
          arity(args, 1)
          reply(replyProxy, bridgeResult(id, openLink(argText(args, 0, MAX_URL_BYTES) ?: error("Invalid URL"))))
        }
        else -> reply(replyProxy, bridgeError(id, "unknown_method", "Unsupported bridge method"))
      }
    }.onFailure {
      reply(replyProxy, bridgeError(id, "bridge_failed", "Android bridge request was rejected"))
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

  fun openLink(url: String): Boolean {
    val uri = safeExternalUri(url) ?: return false
    val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return runCatching {
      activity.startActivity(intent)
      true
    }.getOrDefault(false)
  }

  fun onNotificationPermissionResult(granted: Boolean, cancelled: Boolean = false) {
    notificationState.edit().putBoolean("notification_denied", !granted && !cancelled).apply()
    val state = permissionState()
    val callbacks = permission.toList()
    permission.clear()
    callbacks.forEach { it(state) }
  }

  companion object {
    private const val TRUSTED_ORIGIN = "https://appassets.androidplatform.net"
    private const val DEEP_LINK_CHANNEL = "slopcode.android.deep-links"
    private const val MAX_MESSAGE_BYTES = 256 * 1024
    private const val MAX_ID_BYTES = 128
    private const val MAX_METHOD_BYTES = 64
    private const val MAX_NAMESPACE_BYTES = 128
    private const val MAX_KEY_BYTES = 256
    private const val MAX_VALUE_BYTES = 192 * 1024
    private const val MAX_TEXT_BYTES = 16 * 1024
    private const val MAX_URL_BYTES = 8 * 1024
    private const val MAX_DIRECTORY_CHARS = 4 * 1024
    private const val MAX_PROMPT_CHARS = 16 * 1024
    private const val MAX_NONCE_BYTES = 128
    private const val MAX_ARGS = 8
    private const val MAX_STORAGE_KEYS = 512
    private const val MAX_DEEP_LINKS = 32
  }
}
