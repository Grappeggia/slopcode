package dev.slopcode.android

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal object RemoteJobStatus {
  const val QUEUED = "queued"
  const val RUNNING = "running"
  const val WAITING_APPROVAL = "waiting_approval"
  const val WAITING_QUESTION = "waiting_question"
  const val RETRYING = "retrying"
  const val COMPLETED = "completed"
  const val FAILED = "failed"
  const val STOPPED = "stopped"

  fun terminal(value: String) = value == COMPLETED || value == FAILED || value == STOPPED
}

internal object RemoteJobAction {
  const val APPROVE = "approve"
  const val REJECT = "reject"
  const val ANSWER = "answer"
  const val STEER = "steer"
  const val COMMENT = "comment"
  const val STOP = "stop"
  const val RETRY = "retry"

  fun valid(value: String) = value == APPROVE || value == REJECT || value == ANSWER || value == STEER ||
    value == COMMENT || value == STOP || value == RETRY
}

internal data class RemoteJobSpec(
  val id: String,
  val serverUrl: String,
  val username: String,
  val password: String,
  val workspaceID: String,
  val directory: String,
  val agent: String,
  val prompt: String,
  val config: JSONObject?,
) {
  fun state(now: Long = System.currentTimeMillis()) = RemoteJobState(
    id = id,
    serverUrl = serverUrl,
    username = username,
    password = password,
    workspaceID = workspaceID,
    directory = directory,
    agent = agent,
    prompt = prompt,
    config = config,
    status = RemoteJobStatus.QUEUED,
    updatedAt = now,
  )

  companion object {
    fun parse(raw: String): RemoteJobSpec? {
      val value = runCatching { JSONObject(raw) }.getOrNull() ?: return null
      val serverUrl = value.optString("serverUrl").trim()
      val uri = runCatching { java.net.URI(serverUrl) }.getOrNull()
      if (
        uri?.scheme != "https" ||
        !uri.userInfo.isNullOrEmpty() ||
        !uri.query.isNullOrEmpty() ||
        !uri.fragment.isNullOrEmpty() ||
        uri.host.isNullOrEmpty()
      ) return null
      val username = value.optString("username", "slopcode").trim().ifEmpty { "slopcode" }
      val password = value.optString("password").trim()
      val workspaceID = value.optString("workspaceID").trim()
      val directory = value.optString("directory").trim()
      val agent = value.optString("agent").trim()
      val prompt = value.optString("prompt")
      if (
        username.length > 512 ||
        password.isEmpty() ||
        password.length > 512 ||
        workspaceID.length !in 5..256 ||
        !workspaceID.matches(Regex("wrk[a-zA-Z0-9._:-]+")) ||
        !safeDirectory(directory) ||
        agent !in setOf("codex-cli", "opencode-cli", "claude-code") ||
        prompt.isEmpty() ||
        prompt.length > 32 * 1024 ||
        listOf(username, password, workspaceID, directory, prompt).any { it.any { char -> char == '\u0000' || char == '\r' || char == '\n' } }
      ) return null
      val config = value.optJSONObject("config")?.let { JSONObject(it.toString()) }
      return RemoteJobSpec(
        id = value.optString("jobID").takeIf { it.matches(Regex("job_[A-Za-z0-9._:-]{1,240}")) }
          ?: "job_${UUID.randomUUID().toString().replace("-", "")}",
        serverUrl = serverUrl.trimEnd('/'),
        username = username,
        password = password,
        workspaceID = workspaceID,
        directory = directory,
        agent = agent,
        prompt = prompt,
        config = config,
      )
    }
  }
}

internal data class RemoteJobState(
  val id: String,
  val serverUrl: String,
  val username: String,
  val password: String,
  val workspaceID: String,
  val directory: String,
  val agent: String,
  val prompt: String,
  val config: JSONObject?,
  val status: String,
  val sessionID: String? = null,
  val cursor: String? = null,
  val output: String? = null,
  val error: String? = null,
  val progress: Double? = null,
  val commandPreview: JSONObject? = null,
  val approval: JSONObject? = null,
  val question: JSONObject? = null,
  val review: JSONObject? = null,
  val attempts: Int = 0,
  val started: Boolean = false,
  val updatedAt: Long = System.currentTimeMillis(),
  val seen: List<String> = emptyList(),
) {
  fun publicJson() = toJson(false)

  fun toJson(includeSecret: Boolean) = JSONObject().apply {
    put("id", id)
    put("serverUrl", serverUrl)
    put("username", username)
    if (includeSecret) put("password", password)
    put("workspaceID", workspaceID)
    put("directory", directory)
    put("agent", agent)
    put("prompt", prompt)
    config?.let { put("config", JSONObject(it.toString())) }
    put("status", status)
    sessionID?.let { put("sessionID", it) }
    cursor?.let { put("cursor", it) }
    output?.let { put("output", it) }
    error?.let { put("error", it) }
    progress?.let { put("progress", it) }
    commandPreview?.let { put("commandPreview", JSONObject(it.toString())) }
    approval?.let { put("approval", JSONObject(it.toString())) }
    question?.let { put("question", JSONObject(it.toString())) }
    review?.let { put("review", JSONObject(it.toString())) }
    put("attempts", attempts)
    put("started", started)
    put("updatedAt", updatedAt)
    put("seen", JSONArray(seen.takeLast(MAX_SEEN_EVENTS)))
  }

  companion object {
    private const val MAX_SEEN_EVENTS = 64

    fun parse(value: JSONObject): RemoteJobState? {
      val id = value.optString("id")
      val serverUrl = value.optString("serverUrl")
      val username = value.optString("username", "slopcode")
      val password = value.optString("password")
      val workspaceID = value.optString("workspaceID")
      val directory = value.optString("directory")
      val agent = value.optString("agent")
      val prompt = value.optString("prompt")
      val status = value.optString("status")
      val updatedAt = value.optLong("updatedAt", 0)
      if (
        !id.matches(Regex("job_[A-Za-z0-9._:-]{1,240}")) ||
        !serverUrl.startsWith("https://") ||
        username.isEmpty() ||
        password.isEmpty() ||
        workspaceID.isEmpty() ||
        !safeDirectory(directory) ||
        agent !in setOf("codex-cli", "opencode-cli", "claude-code") ||
        prompt.isEmpty() ||
        status !in setOf(
          RemoteJobStatus.QUEUED,
          RemoteJobStatus.RUNNING,
          RemoteJobStatus.WAITING_APPROVAL,
          RemoteJobStatus.WAITING_QUESTION,
          RemoteJobStatus.RETRYING,
          RemoteJobStatus.COMPLETED,
          RemoteJobStatus.FAILED,
          RemoteJobStatus.STOPPED,
        ) ||
        updatedAt <= 0
      ) return null
      val seen = value.optJSONArray("seen")?.let { array ->
        (0 until array.length()).mapNotNull { index ->
          array.optString(index).takeIf { it.length in 1..256 }
        }.takeLast(MAX_SEEN_EVENTS)
      } ?: emptyList()
      val progress = if (value.has("progress")) value.optDouble("progress", -1.0).takeIf { it in 0.0..1.0 } else null
      if (value.has("progress") && progress == null) return null
      val approval = value.optJSONObject("approval") ?: value.optString("approval").takeIf { it.isNotEmpty() }?.let {
        JSONObject().put("title", it)
      }
      return RemoteJobState(
        id = id,
        serverUrl = serverUrl.trimEnd('/'),
        username = username,
        password = password,
        workspaceID = workspaceID,
        directory = directory,
        agent = agent,
        prompt = prompt,
        config = value.optJSONObject("config")?.let { JSONObject(it.toString()) },
        status = status,
        sessionID = value.optString("sessionID").takeIf(String::isNotEmpty),
        cursor = value.optString("cursor").takeIf(String::isNotEmpty),
        output = value.optString("output").takeIf(String::isNotEmpty),
        error = value.optString("error").takeIf(String::isNotEmpty),
        progress = progress,
        commandPreview = value.optJSONObject("commandPreview")?.let { JSONObject(it.toString()) },
        approval = approval?.let { JSONObject(it.toString()) },
        question = value.optJSONObject("question")?.let { JSONObject(it.toString()) },
        review = value.optJSONObject("review")?.let { JSONObject(it.toString()) },
        attempts = value.optInt("attempts", 0).coerceAtLeast(0),
        started = value.optBoolean("started", value.optInt("attempts", 0) > 0),
        updatedAt = updatedAt,
        seen = seen,
      )
    }
  }
}

internal data class RemoteJobEvent(
  val id: String?,
  val cursor: String?,
  val jobID: String,
  val type: String,
  val data: JSONObject,
) {
  companion object {
    fun parse(raw: String): RemoteJobEvent? {
      val value = runCatching { JSONObject(raw) }.getOrNull() ?: return null
      return parse(value)
    }

    fun parse(value: JSONObject): RemoteJobEvent? {
      val data = value.optJSONObject("data") ?: value
      val jobID = value.optString("jobID", value.optString("jobId")).takeIf { it.isNotEmpty() } ?: return null
      val type = value.optString("type", value.optString("event")).takeIf { it.isNotEmpty() } ?: return null
      val id = value.optString("id").takeIf { it.isNotEmpty() }
      val cursor = value.optString("cursor").takeIf { it.isNotEmpty() }
      return RemoteJobEvent(id, cursor, jobID, type, JSONObject(data.toString()))
    }
  }
}

internal object RemoteJobReducer {
  fun apply(current: RemoteJobState, event: RemoteJobEvent, now: Long = System.currentTimeMillis()): RemoteJobState {
    if (event.jobID != current.id) return current
    val key = event.cursor ?: event.id
    if (key != null && (key == current.cursor || current.seen.contains(key))) return current
    val type = event.type.removePrefix("job.").removePrefix("remote.job.")
    val reviewEvent = type.endsWith("review.updated") || type.endsWith("comment")
    if (RemoteJobStatus.terminal(current.status) && !reviewEvent) return current
    val status = when {
      type.endsWith("completed") -> RemoteJobStatus.COMPLETED
      type.endsWith("failed") -> RemoteJobStatus.FAILED
      type.endsWith("stopped") || type == "stop" -> RemoteJobStatus.STOPPED
      type.endsWith("retry") || type == "retried" -> RemoteJobStatus.RETRYING
      type.endsWith("approval") || type.endsWith("approval_required") || type.endsWith("waiting_approval") ->
        RemoteJobStatus.WAITING_APPROVAL
      type.endsWith("question") -> RemoteJobStatus.WAITING_QUESTION
      reviewEvent -> current.status
      else -> RemoteJobStatus.RUNNING
    }
    val chunk = event.data.optString("output").takeIf(String::isNotEmpty)
    val output = if (chunk == null) current.output else "${current.output.orEmpty()}$chunk".takeLast(MAX_OUTPUT_BYTES)
    val error = event.data.optString("error").takeIf(String::isNotEmpty)
      ?: if (status == RemoteJobStatus.FAILED || status == RemoteJobStatus.STOPPED) {
        event.data.optString("message").takeIf(String::isNotEmpty)
      } else null
      ?: current.error
    val progress = if (event.data.has("progress")) event.data.optDouble("progress", -1.0).takeIf { it in 0.0..1.0 } else current.progress
    val sessionID = event.data.optString("sessionID").takeIf(String::isNotEmpty) ?: current.sessionID
    val commandPreview = event.data.optJSONObject("commandPreview")?.let { JSONObject(it.toString()) } ?: current.commandPreview
    val approval = event.data.optJSONObject("approval")?.let { JSONObject(it.toString()) }
      ?: event.data.optString("approval").takeIf(String::isNotEmpty)?.let { JSONObject().put("title", it) }
      ?: current.approval
    val question = event.data.optJSONObject("question")?.let { JSONObject(it.toString()) } ?: current.question
    val review = event.data.optJSONObject("review")?.let { JSONObject(it.toString()) } ?: current.review
    val seen = if (key == null) current.seen else (current.seen + key).takeLast(MAX_SEEN_EVENTS)
    return current.copy(
      status = status,
      sessionID = sessionID,
      cursor = key ?: current.cursor,
      output = output,
      error = error,
      progress = progress,
      commandPreview = commandPreview,
      approval = approval,
      question = question,
      review = review,
      updatedAt = now,
      seen = seen,
    )
  }

  private const val MAX_OUTPUT_BYTES = 64 * 1024
  private const val MAX_SEEN_EVENTS = 64
}

internal fun safeDirectory(value: String): Boolean {
  if (!value.startsWith("/") || value.length > 4_096 || value.contains("\\") || value.contains("//")) return false
  if (value.any { it == '\u0000' || it == '\r' || it == '\n' || it == '?' || it == '#' }) return false
  return value.split('/').none { it == "." || it == ".." }
}

internal fun remoteJobDeepLink(job: RemoteJobState) =
  "slopcode://remote-session?job=${job.id}${job.sessionID?.let { "&session=$it" }.orEmpty()}"
