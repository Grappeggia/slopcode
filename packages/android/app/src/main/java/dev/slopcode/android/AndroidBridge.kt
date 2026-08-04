package dev.slopcode.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.io.ByteArrayOutputStream

class AndroidBridge(
  private val activity: MainActivity,
  private val webView: WebView,
) {
  private val notificationState = activity.getSharedPreferences("slopcode.permission", android.content.Context.MODE_PRIVATE)
  private val deepLinks = DeepLinkDelivery(MAX_DEEP_LINKS)
  private val deepLinkLock = Any()
  private val permission = CopyOnWriteArrayList<(String) -> Unit>()
  private val storageLock = Any()
  private val channelId = "slopcode.android"
  private val manager = activity.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as NotificationManager
  private val key = MasterKey.Builder(activity).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
  private val deepLinkPrefs = EncryptedSharedPreferences.create(
    activity,
    "slopcode.deep.links",
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )
  private val jobs = RemoteJobStore(activity)
  private val sshEvents = CopyOnWriteArrayList<String>()
  private val ssh = SshTransport(activity, ::queueSshEvent)
  private val sshExecutor = Executors.newSingleThreadExecutor()
  @Volatile private var privateKeyReply: ((String?) -> Unit)? = null
  @Volatile private var rendererReady = false
  @Volatile private var rendererNonce: String? = null
  @Volatile private var jobsReady = false
  @Volatile private var jobsNonce: String? = null
  @Volatile private var sshReady = false
  @Volatile private var sshNonce: String? = null
  @Volatile private var sshGeneration = 0L
  private val jobReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (!jobsReady || jobsNonce == null) return
      val job = intent?.getStringExtra(RemoteJobStore.EXTRA_JOB) ?: return
      val event = intent.getStringExtra(RemoteJobStore.EXTRA_EVENT) ?: return
      postJobEvent(job, event)
    }
  }

  init {
    val channel = NotificationChannel(channelId, "SlopCode", NotificationManager.IMPORTANCE_DEFAULT)
    manager.createNotificationChannel(channel)
    permissionState()
    restoreDeepLinkHistory()
    ContextCompat.registerReceiver(
      activity,
      jobReceiver,
      IntentFilter(RemoteJobStore.ACTION_JOB_CHANGED),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
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

  private fun argPayload(args: JSONArray, index: Int, limit: Int, required: Boolean = true): String? {
    val value = args.opt(index) as? String ?: return null
    if (value.toByteArray(Charsets.UTF_8).size > limit || value.contains('\u0000')) return null
    if (required && value.isBlank()) return null
    return value
  }

  private fun argInt(args: JSONArray, index: Int): Int? {
    val value = args.opt(index) as? Number ?: return null
    val next = value.toLong()
    if (next !in Int.MIN_VALUE..Int.MAX_VALUE || value.toDouble() != next.toDouble()) return null
    return next.toInt()
  }

  private fun argBoolean(args: JSONArray, index: Int): Boolean? = args.opt(index) as? Boolean

  private fun sshAsync(id: String, proxy: JavaScriptReplyProxy, work: () -> Any?) {
    sshExecutor.execute {
      runCatching { work() }
        .onSuccess { result -> reply(proxy, bridgeResult(id, result)) }
        .onFailure { cause -> replyFailure(proxy, id, cause) }
    }
  }

  private fun replyFailure(proxy: JavaScriptReplyProxy, id: String?, cause: Throwable) {
    val error = cause as? SshTransportException
    reply(
      proxy,
      bridgeError(
        id,
        error?.code ?: "bridge_failed",
        (error?.message ?: cause.message ?: "Android bridge request was rejected").take(MAX_ERROR_BYTES),
      ),
    )
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
    if (host == "remote-session") {
      if (uri.queryParameterNames.any { it != "job" && it != "session" }) return null
      val job = uri.getQueryParameters("job")
      val session = uri.getQueryParameters("session")
      if (
        job.size != 1 ||
        !job[0].matches(Regex("(?:job|pty|ses)_[A-Za-z0-9._:-]+")) ||
        session.size > 1 ||
        (session.singleOrNull()?.matches(Regex("(?:ses|pty)_[A-Za-z0-9._:-]+")) == false)
      ) return null
      return Uri.Builder()
        .scheme("slopcode")
        .authority("remote-session")
        .appendQueryParameter("job", job[0])
        .apply { session.singleOrNull()?.let { appendQueryParameter("session", it) } }
        .build()
        .toString()
    }
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
    synchronized(deepLinkLock) {
      if (!deepLinks.enqueue(value)) return
      persistDeepLinkHistory()
    }
  }

  fun onRendererNavigation() {
    rendererReady = false
    rendererNonce = null
    jobsReady = false
    jobsNonce = null
    sshReady = false
    sshNonce = null
    synchronized(sshEvents) {
      sshGeneration += 1
      sshEvents.clear()
    }
    ssh.disconnect()
  }

  fun onPrivateKeyResult(uri: Uri?) {
    val done = privateKeyReply
    privateKeyReply = null
    done?.invoke(uri?.let(::readPrivateKey))
  }

  private fun readPrivateKey(uri: Uri): String? {
    val output = ByteArrayOutputStream()
    return runCatching {
      activity.contentResolver.openInputStream(uri)?.use { input ->
        val buffer = ByteArray(8 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          output.write(buffer, 0, count)
          check(output.size() <= MAX_PRIVATE_KEY_BYTES) { "Private key file is too large" }
        }
      } ?: return null
      val value = output.toString(Charsets.UTF_8.name())
      check(value.startsWith("-----BEGIN ") && value.contains("PRIVATE KEY-----")) { "Selected file is not an SSH private key" }
      check(value.none { it == '\u0000' || it == '\r' }) { "Selected private key is invalid" }
      value
    }.getOrNull()
  }

  private fun pickPrivateKey(done: (String?) -> Unit) {
    check(privateKeyReply == null) { "A private-key picker is already open" }
    privateKeyReply = done
    activity.pickPrivateKey()
  }

  fun flushDeepLinks() {
    if (!rendererReady) return
    val nonce = rendererNonce ?: return
    val urls = peekLinks()
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
        synchronized(deepLinkLock) {
          deepLinks.requeue(urls)
          persistDeepLinkHistory()
        }
        return@post
      }
      WebViewCompat.postWebMessage(webView, WebMessageCompat(payload), Uri.parse(TRUSTED_ORIGIN))
    }
  }

  private fun consumeLinks(): List<String> = synchronized(deepLinkLock) {
    val urls = deepLinks.consume()
    persistDeepLinkHistory()
    urls
  }

  private fun peekLinks(): List<String> = synchronized(deepLinkLock) {
    deepLinks.peek()
  }

  private fun restoreDeepLinkHistory() {
    val raw = deepLinkPrefs.getString(DEEP_LINK_HISTORY, null) ?: return
    val value = runCatching { JSONObject(raw) }.getOrNull() ?: return
    val storedHistory = value.optJSONObject("history") ?: value
    val history = storedHistory.keys().asSequence().mapNotNull { url ->
      val timestamp = storedHistory.optLong(url, -1L).takeIf { it > 0 }
      timestamp?.let { url to it }
    }.toMap()
    val queued = value.optJSONArray("pending")?.let { array ->
      (0 until array.length()).mapNotNull { index -> array.optString(index).takeIf(String::isNotBlank) }
    } ?: emptyList()
    synchronized(deepLinkLock) {
      deepLinks.restore(history, queued)
      persistDeepLinkHistory()
    }
  }

  private fun persistDeepLinkHistory() {
    val history = JSONObject()
    deepLinks.history().forEach { (url, timestamp) -> history.put(url, timestamp) }
    val pending = JSONArray()
    deepLinks.peek().forEach(pending::put)
    val value = JSONObject().put("history", history).put("pending", pending)
    check(deepLinkPrefs.edit().putString(DEEP_LINK_HISTORY, value.toString()).commit()) { "Deep-link history could not be persisted" }
  }

  private fun capabilities() =
    JSONObject()
      .put("secureStorage", true)
      .put("qrPairing", false)
      .put("notifications", true)
      .put("deepLinks", true)
      .put("remoteTransport", ssh.isConnected())
      .put("backgroundExecution", true)
      .put("remoteJobs", true)

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
        "setSystemBars" -> {
          arity(args, 1)
          activity.applySystemBars(argBoolean(args, 0) ?: error("Invalid system-bar appearance"))
          reply(replyProxy, bridgeResult(id))
        }
        "systemInsets" -> {
          arity(args, 0)
          reply(replyProxy, bridgeResult(id, activity.systemInsets()))
        }
        "remoteJobsReady" -> {
          arity(args, 1)
          jobsNonce = deepLinkNonce(args, 0)
          jobsReady = true
          reply(replyProxy, bridgeResult(id, true))
        }
        "sshEventsReady" -> {
          arity(args, 1)
          synchronized(sshEvents) {
            sshGeneration += 1
            sshEvents.clear()
          }
          sshNonce = deepLinkNonce(args, 0)
          sshReady = true
          flushSshEvents()
          reply(replyProxy, bridgeResult(id, true))
        }
        "sshConnect" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH configuration")
          val attempt = ssh.reserveConnect()
          sshAsync(id, replyProxy) { ssh.connect(raw, attempt) }
        }
        "sshCancelConnect" -> {
          arity(args, 0)
          ssh.cancelConnect()
          reply(replyProxy, bridgeResult(id, true))
        }
        "sshTrustHostKey" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid host-key confirmation")
          sshAsync(id, replyProxy) { ssh.trust(raw) }
        }
        "sshStatus" -> {
          arity(args, 0)
          sshAsync(id, replyProxy) { ssh.status() }
        }
        "sshDisconnect" -> {
          arity(args, 0)
          sshAsync(id, replyProxy) {
            ssh.disconnect()
            ssh.status()
          }
        }
        "sshCleanup" -> {
          arity(args, 0)
          sshAsync(id, replyProxy) {
            ssh.cleanup()
            ssh.status()
          }
        }
        "sshHome" -> {
          arity(args, 0)
          sshAsync(id, replyProxy) { ssh.home() }
        }
        "sshList" -> {
          arity(args, 1, 2)
          val path = argText(args, 0, MAX_DIRECTORY_CHARS) ?: error("Invalid remote folder")
          val showHidden = if (args.length() == 2) argBoolean(args, 1) ?: error("Invalid hidden-entry setting") else false
          sshAsync(id, replyProxy) { ssh.list(path, showHidden) }
        }
        "sshSelectWorkspace" -> {
          arity(args, 1)
          val path = argText(args, 0, MAX_DIRECTORY_CHARS) ?: error("Invalid remote workspace")
          sshAsync(id, replyProxy) { ssh.selectWorkspace(path) }
        }
        "sshExec" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH exec request")
          sshAsync(id, replyProxy) { ssh.version(raw) }
        }
        "sshUpdateCheck" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH update check")
          sshAsync(id, replyProxy) { ssh.update(raw) }
        }
        "sshAuthStatus" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH authentication check")
          sshAsync(id, replyProxy) { ssh.authStatus(raw) }
        }
        "sshCodexAppServerStatus" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid Codex App Server request")
          sshAsync(id, replyProxy) { ssh.codexAppServerStatus(raw) }
        }
        "sshStart" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH session request")
          sshAsync(id, replyProxy) { ssh.start(raw) }
        }
        "sshOrchestratorStart" -> {
          arity(args, 1)
          val raw = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH orchestrator request")
          sshAsync(id, replyProxy) { ssh.orchestratorStart(raw) }
        }
        "sshOrchestratorInput" -> {
          arity(args, 1)
          val value = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH orchestrator frame")
          sshAsync(id, replyProxy) {
            ssh.orchestratorInput(value)
            true
          }
        }
        "sshOrchestratorStop" -> {
          arity(args, 0)
          sshAsync(id, replyProxy) {
            ssh.orchestratorStop()
            true
          }
        }
        "sshInput" -> {
          arity(args, 1)
          val value = argPayload(args, 0, MAX_VALUE_BYTES) ?: error("Invalid SSH input")
          sshAsync(id, replyProxy) {
            ssh.input(value)
            true
          }
        }
        "sshResize" -> {
          arity(args, 4)
          val cols = argInt(args, 0) ?: error("Invalid terminal columns")
          val rows = argInt(args, 1) ?: error("Invalid terminal rows")
          val width = argInt(args, 2) ?: error("Invalid terminal width")
          val height = argInt(args, 3) ?: error("Invalid terminal height")
          sshAsync(id, replyProxy) {
            ssh.resize(
              cols,
              rows,
              width,
              height,
            )
            true
          }
        }
        "sshInterrupt" -> {
          arity(args, 0)
          sshAsync(id, replyProxy) {
            ssh.interrupt()
            true
          }
        }
        "sshCredentialGet" -> {
          arity(args, 1)
          val profile = argText(args, 0, MAX_PROFILE_BYTES) ?: error("Invalid SSH credential profile")
          check(validProfile(profile)) { "Invalid SSH credential profile" }
          sshAsync(id, replyProxy) { ssh.credentials.get(profile) ?: JSONObject.NULL }
        }
        "sshCredentialSet" -> {
          arity(args, 2)
          val profile = argText(args, 0, MAX_PROFILE_BYTES) ?: error("Invalid SSH credential profile")
          check(validProfile(profile)) { "Invalid SSH credential profile" }
          val raw = argPayload(args, 1, MAX_VALUE_BYTES) ?: error("Invalid SSH credentials")
          val value = JSONObject(raw)
          val auth = value.optString("auth")
          check(auth == "password" || auth == "privateKey") { "Invalid SSH authentication method" }
          check(value.optString("password").length <= MAX_SECRET_BYTES) { "SSH password is too long" }
          check(value.optString("privateKey").toByteArray(Charsets.UTF_8).size <= MAX_PRIVATE_KEY_BYTES) { "SSH private key is too large" }
          check(value.optString("passphrase").length <= MAX_SECRET_BYTES) { "SSH key passphrase is too long" }
          sshAsync(id, replyProxy) {
            ssh.credentials.save(profile, value)
            true
          }
        }
        "sshCredentialClear" -> {
          arity(args, 1)
          val profile = argText(args, 0, MAX_PROFILE_BYTES) ?: error("Invalid SSH credential profile")
          check(validProfile(profile)) { "Invalid SSH credential profile" }
          sshAsync(id, replyProxy) {
            ssh.credentials.clear(profile)
            true
          }
        }
        "sshPickPrivateKey" -> {
          arity(args, 0)
          pickPrivateKey { value -> reply(replyProxy, bridgeResult(id, value ?: JSONObject.NULL)) }
        }
        "remoteJobList" -> {
          arity(args, 0)
          val list = JSONArray()
          jobs.list().forEach { list.put(it.publicJson()) }
          reply(replyProxy, bridgeResult(id, list))
        }
        "remoteJobStart" -> {
          arity(args, 1)
          val raw = argText(args, 0, MAX_VALUE_BYTES) ?: error("Invalid remote job")
          val spec = RemoteJobSpec.parse(raw) ?: error("Invalid remote job")
          reply(replyProxy, bridgeResult(id, RemoteJobService.enqueue(activity, spec).publicJson()))
        }
        "remoteJobAction" -> {
          arity(args, 2, 3)
          val jobID = argText(args, 0, MAX_ID_BYTES) ?: error("Invalid remote job ID")
          check(jobID.matches(Regex("job_[A-Za-z0-9._:-]{1,240}"))) { "Invalid remote job ID" }
          val action = argText(args, 1, 32) ?: error("Invalid remote job action")
          check(RemoteJobAction.valid(action)) { "Invalid remote job action" }
          val payload = argText(args, 2, 16 * 1024, required = false)
          payload?.let { check(runCatching { JSONObject(it) }.isSuccess) { "Invalid remote job payload" } }
          RemoteJobService.action(activity, jobID, action, payload)
          reply(replyProxy, bridgeResult(id, jobs.get(jobID)?.publicJson() ?: JSONObject.NULL))
        }
        else -> reply(replyProxy, bridgeError(id, "unknown_method", "Unsupported bridge method"))
      }
    }.onFailure { cause -> replyFailure(replyProxy, id, cause) }
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

  private fun postJobEvent(job: String, event: String) {
    val nonce = jobsNonce ?: return
    val payload = JSONObject()
      .put("type", "slopcode.remote-job")
      .put("channel", REMOTE_JOB_CHANNEL)
      .put("nonce", nonce)
      .put("job", JSONObject(job))
      .put("event", JSONObject(event))
      .toString()
    webView.post {
      if (!jobsReady || jobsNonce != nonce) return@post
      WebViewCompat.postWebMessage(webView, WebMessageCompat(payload), Uri.parse(TRUSTED_ORIGIN))
    }
  }

  private fun queueSshEvent(event: JSONObject) {
    synchronized(sshEvents) {
      while (sshEvents.size >= MAX_SSH_EVENTS) sshEvents.removeAt(0)
      sshEvents += JSONObject(event.toString()).put("generation", sshGeneration).toString()
    }
    flushSshEvents()
  }

  private fun flushSshEvents() {
    if (!sshReady) return
    val nonce = sshNonce ?: return
    val generation = sshGeneration
    val events = synchronized(sshEvents) {
      val next = sshEvents.toList()
      sshEvents.clear()
      next
    }
    if (events.isEmpty()) return
    webView.post {
      if (!sshReady || sshNonce != nonce || sshGeneration != generation) {
        synchronized(sshEvents) {
          events.forEach { sshEvents.add(0, it) }
        }
        return@post
      }
      events.forEach { event ->
        if (JSONObject(event).optLong("generation", -1) != generation) return@forEach
        val payload = JSONObject()
          .put("type", "slopcode.ssh")
          .put("channel", SSH_CHANNEL)
          .put("nonce", nonce)
          .put("event", JSONObject(event))
          .toString()
        WebViewCompat.postWebMessage(webView, WebMessageCompat(payload), Uri.parse(TRUSTED_ORIGIN))
      }
    }
  }

  fun close() {
    sshExecutor.shutdownNow()
    ssh.close()
    runCatching { activity.unregisterReceiver(jobReceiver) }
  }

  companion object {
    private const val TRUSTED_ORIGIN = "https://appassets.androidplatform.net"
    private const val REMOTE_JOB_CHANNEL = "slopcode.android.remote-jobs"
    private const val SSH_CHANNEL = "slopcode.android.ssh"
    private const val DEEP_LINK_CHANNEL = "slopcode.android.deep-links"
    private const val MAX_MESSAGE_BYTES = 256 * 1024
    private const val MAX_ID_BYTES = 128
    private const val MAX_METHOD_BYTES = 64
    private const val MAX_NAMESPACE_BYTES = 128
    private const val MAX_KEY_BYTES = 256
    private const val MAX_VALUE_BYTES = 192 * 1024
    private const val MAX_PROFILE_BYTES = 320
    private const val MAX_SECRET_BYTES = 16 * 1024
    private const val MAX_PRIVATE_KEY_BYTES = 128 * 1024
    private const val MAX_DIRECTORY_CHARS = 4_096
    private const val MAX_ERROR_BYTES = 2 * 1024
    private const val MAX_SSH_EVENTS = 128
    private const val MAX_TEXT_BYTES = 16 * 1024
    private const val MAX_URL_BYTES = 8 * 1024
    private const val MAX_PROMPT_CHARS = 16 * 1024
    private const val MAX_NONCE_BYTES = 128
    private const val MAX_ARGS = 8
    private const val MAX_STORAGE_KEYS = 512
    private const val MAX_DEEP_LINKS = 32
    private const val DEEP_LINK_HISTORY = "history.v1"
  }
}
