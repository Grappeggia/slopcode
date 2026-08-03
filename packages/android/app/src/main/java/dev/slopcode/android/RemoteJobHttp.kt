package dev.slopcode.android

import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSource
import org.json.JSONObject
import java.util.Base64
import java.util.concurrent.TimeUnit

internal sealed class RemoteJobStartResult {
  data class Accepted(val sessionID: String?, val cursor: String?) : RemoteJobStartResult()
  data class Immediate(
    val output: String,
    val status: String,
    val error: String? = null,
    val commandPreview: JSONObject? = null,
    val review: JSONObject? = null,
  ) : RemoteJobStartResult()
}

internal sealed class RemoteJobStreamResult {
  data object Unsupported : RemoteJobStreamResult()
  data object Disconnected : RemoteJobStreamResult()
  data object Complete : RemoteJobStreamResult()
}

internal class RemoteJobHttp(
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(35, TimeUnit.SECONDS)
    .writeTimeout(15, TimeUnit.SECONDS)
    .retryOnConnectionFailure(true)
    .build(),
) {
  fun start(job: RemoteJobState, pushToken: String? = null): RemoteJobStartResult {
    val payload = JSONObject().apply {
      put("jobID", job.id)
      put("agent", job.agent)
      put("prompt", job.prompt)
      job.config?.let { put("config", JSONObject(it.toString())) }
      pushToken?.takeIf { it.length in 1..4096 }?.let { put("pushToken", it) }
    }
    val response = call(
      job,
      path = "remote/agent/job",
      method = "POST",
      query = mapOf("workspace" to job.workspaceID, "path" to job.directory),
      body = payload,
      headers = mapOf("Idempotency-Key" to job.id),
    )
    if (response.code == 404 || response.code == 405) {
      response.close()
      return startLegacy(job, pushToken)
    }
    return response.use(::startResult)
  }

  fun stream(
    job: RemoteJobState,
    cursor: String?,
    onEvent: (RemoteJobEvent) -> Boolean,
  ): RemoteJobStreamResult {
    val query = mutableMapOf(
      "job" to job.id,
      "workspace" to job.workspaceID,
      "path" to job.directory,
    )
    if (!cursor.isNullOrEmpty()) query["cursor"] = cursor
    val url = url(job, "remote/agent/job/events", query)
    val request = Request.Builder()
      .url(url)
      .header("Authorization", authorization(job.username, job.password))
      .header("Accept", "text/event-stream")
      .apply { if (!cursor.isNullOrEmpty()) header("Last-Event-ID", cursor) }
      .build()
    val response = client.newCall(request).execute()
    if (response.code == 404 || response.code == 405) {
      response.close()
      return RemoteJobStreamResult.Unsupported
    }
    if (!response.isSuccessful) {
      val code = response.code
      val message = response.body?.string().orEmpty().take(512)
      response.close()
      throw RemoteJobHttpException(code, message)
    }
    response.use { parseSse(it.body?.source() ?: return RemoteJobStreamResult.Disconnected, onEvent) }
    return RemoteJobStreamResult.Complete
  }

  fun action(job: RemoteJobState, action: String, payload: JSONObject? = null): Boolean {
    if (!RemoteJobAction.valid(action)) return false
    val key = remoteJobActionIdempotencyKey(job, action)
    val body = JSONObject().apply {
      payload?.keys()?.forEach { key -> put(key, payload.opt(key)) }
      put("action", action)
      put("idempotencyKey", key)
      remoteJobActionContext(job, action)?.let {
        put("interactionID", it.id)
        put("expectedRevision", it.revision)
      }
    }
    val response = call(
      job,
      path = "remote/agent/job/${job.id}/action",
      method = "POST",
      query = mapOf("workspace" to job.workspaceID, "path" to job.directory),
      body = body,
      headers = mapOf("Idempotency-Key" to key),
    )
    response.use {
      return it.isSuccessful
    }
  }

  private fun startLegacy(job: RemoteJobState, pushToken: String?): RemoteJobStartResult {
    val payload = JSONObject().apply {
      put("agent", job.agent)
      put("prompt", job.prompt)
      job.config?.let { put("config", JSONObject(it.toString())) }
      pushToken?.takeIf { it.length in 1..4096 }?.let { put("pushToken", it) }
    }
    val response = call(
      job,
      path = "remote/agent/prompt",
      method = "POST",
      query = mapOf("workspace" to job.workspaceID, "path" to job.directory),
      body = payload,
      headers = mapOf("Idempotency-Key" to job.id),
    )
    return response.use(::startResult)
  }

  private fun startResult(response: Response): RemoteJobStartResult {
    val raw = response.body?.string().orEmpty().take(128 * 1024)
    if (!response.isSuccessful) throw RemoteJobHttpException(response.code, raw.take(512))
    val value = runCatching { JSONObject(raw) }.getOrNull() ?: throw RemoteJobHttpException(502, "Invalid remote job response")
    val nested = value.optJSONObject("job") ?: value
    val status = nested.optString("status")
    if (nested.has("output") || status == RemoteJobStatus.COMPLETED || status == RemoteJobStatus.FAILED || status == "timed_out") {
      val output = nested.optString("output")
      val normalized = when (status) {
        "completed" -> RemoteJobStatus.COMPLETED
        "failed", "timed_out" -> RemoteJobStatus.FAILED
        else -> if (nested.optInt("exitCode", 0) == 0) RemoteJobStatus.COMPLETED else RemoteJobStatus.FAILED
      }
      return RemoteJobStartResult.Immediate(
        output = output,
        status = normalized,
        error = nested.optString("error").takeIf(String::isNotEmpty),
        commandPreview = nested.optJSONObject("commandPreview")?.let { JSONObject(it.toString()) },
        review = nested.optJSONObject("review")?.let { JSONObject(it.toString()) },
      )
    }
    val sessionID = nested.optString("sessionID").takeIf(String::isNotEmpty)
      ?: nested.optString("sessionId").takeIf(String::isNotEmpty)
    val cursor = nested.optString("cursor").takeIf(String::isNotEmpty)
    return RemoteJobStartResult.Accepted(sessionID, cursor)
  }

  private fun call(
    job: RemoteJobState,
    path: String,
    method: String,
    query: Map<String, String>,
    body: JSONObject? = null,
    headers: Map<String, String> = emptyMap(),
  ): Response {
    val request = Request.Builder()
      .url(url(job, path, query))
      .header("Authorization", authorization(job.username, job.password))
      .header("Accept", "application/json")
      .apply {
        headers.forEach { (key, value) -> header(key, value) }
        if (body != null) {
          method(method, body.toString().toRequestBody(JSON.toMediaType()))
        } else {
          method(method, null)
        }
      }
      .build()
    return client.newCall(request).execute()
  }

  private fun url(job: RemoteJobState, path: String, query: Map<String, String>) =
    job.serverUrl.toHttpUrl().newBuilder().apply {
      addPathSegments(path)
      query.forEach { (key, value) -> addQueryParameter(key, value) }
    }.build()

  private fun authorization(username: String, password: String): String {
    val raw = "$username:$password".toByteArray(Charsets.UTF_8)
    return "Basic ${Base64.getEncoder().encodeToString(raw)}"
  }

  private fun parseSse(source: BufferedSource, onEvent: (RemoteJobEvent) -> Boolean): RemoteJobStreamResult {
    var id: String? = null
    var event = "message"
    val data = StringBuilder()
    fun flush(): Boolean {
      if (data.isEmpty()) return true
      val value = JSONObject().apply {
        id?.let { put("id", it) }
        put("event", event)
        put("data", runCatching { JSONObject(data.toString()) }.getOrDefault(JSONObject().put("message", data.toString())))
      }
      val parsed = RemoteJobEvent.parse(value)
      id = null
      event = "message"
      data.clear()
      return parsed == null || onEvent(parsed)
    }
    while (!source.exhausted()) {
      val line = source.readUtf8Line() ?: break
      if (line.isEmpty()) {
        if (!flush()) return RemoteJobStreamResult.Complete
        continue
      }
      if (line.startsWith(":")) continue
      val separator = line.indexOf(':')
      val field = if (separator < 0) line else line.substring(0, separator)
      val value = if (separator < 0) "" else line.substring(separator + 1).trimStart()
      when (field) {
        "id" -> id = value.take(256)
        "event" -> event = value.take(128)
        "data" -> {
          if (data.isNotEmpty()) data.append('\n')
          data.append(value.take(64 * 1024))
        }
      }
    }
    flush()
    return RemoteJobStreamResult.Disconnected
  }

  companion object {
    private const val JSON = "application/json; charset=utf-8"
  }
}

internal class RemoteJobHttpException(val status: Int, message: String) : Exception(message)
