package dev.slopcode.android

import android.content.Context
import android.content.Intent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray

internal class RemoteJobStore(context: Context) {
  private val app = context.applicationContext
  private val lock = Any()
  private val key = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
  private val prefs = EncryptedSharedPreferences.create(
    app,
    FILE,
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  fun list(): List<RemoteJobState> = synchronized(lock) {
    read().sortedByDescending { it.updatedAt }
  }

  fun get(id: String): RemoteJobState? = synchronized(lock) {
    read().firstOrNull { it.id == id }
  }

  fun start(spec: RemoteJobSpec): RemoteJobState = synchronized(lock) {
    val current = read()
    val existing = current.firstOrNull { it.id == spec.id }
    if (existing != null && !RemoteJobStatus.terminal(existing.status)) return existing
    val next = spec.state()
    write((current.filterNot { it.id == spec.id } + next).takeLast(MAX_JOBS))
    notify(next, RemoteJobEvent(null, null, next.id, "job.queued", org.json.JSONObject()))
    next
  }

  fun save(job: RemoteJobState, event: RemoteJobEvent? = null) = synchronized(lock) {
    val next = (read().filterNot { it.id == job.id } + job).takeLast(MAX_JOBS)
    write(next)
    notify(job, event)
    job
  }

  fun update(id: String, event: RemoteJobEvent? = null, change: (RemoteJobState) -> RemoteJobState): RemoteJobState? =
    synchronized(lock) {
      val current = read().firstOrNull { it.id == id } ?: return@synchronized null
      val next = change(current)
      val jobs = (read().filterNot { it.id == id } + next).takeLast(MAX_JOBS)
      write(jobs)
      notify(next, event)
      next
    }

  fun updateIf(
    id: String,
    event: RemoteJobEvent? = null,
    predicate: (RemoteJobState) -> Boolean,
    change: (RemoteJobState) -> RemoteJobState,
  ): RemoteJobState? = synchronized(lock) {
    val current = read().firstOrNull { it.id == id } ?: return@synchronized null
    if (!predicate(current)) return@synchronized null
    val next = change(current)
    val jobs = (read().filterNot { it.id == id } + next).takeLast(MAX_JOBS)
    write(jobs)
    notify(next, event)
    next
  }

  fun fcmToken(): String? = synchronized(lock) {
    prefs.getString(FCM_TOKEN, null)
  }

  fun setFcmToken(value: String) = synchronized(lock) {
    prefs.edit().putString(FCM_TOKEN, value.take(MAX_TOKEN_LENGTH)).commit()
  }

  private fun read(): List<RemoteJobState> {
    val raw = prefs.getString(JOBS, null) ?: return emptyList()
    val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
    return (0 until array.length()).mapNotNull { index ->
      array.optJSONObject(index)?.let(RemoteJobState::parse)
    }
  }

  private fun write(jobs: List<RemoteJobState>) {
    val value = JSONArray()
    jobs.takeLast(MAX_JOBS).forEach { value.put(it.toJson(true)) }
    check(prefs.edit().putString(JOBS, value.toString()).commit()) { "Remote job state could not be persisted" }
  }

  private fun notify(job: RemoteJobState, event: RemoteJobEvent?) {
    val intent = Intent(ACTION_JOB_CHANGED)
      .setPackage(app.packageName)
      .putExtra(EXTRA_JOB, job.publicJson().toString())
    event?.let { intent.putExtra(EXTRA_EVENT, eventJson(it).toString()) }
    app.sendBroadcast(intent)
  }

  private fun eventJson(event: RemoteJobEvent) = org.json.JSONObject().apply {
    event.id?.let { put("id", it) }
    event.cursor?.let { put("cursor", it) }
    put("jobID", event.jobID)
    put("type", event.type)
    put("data", org.json.JSONObject(event.data.toString()))
  }

  companion object {
    const val ACTION_JOB_CHANGED = "dev.slopcode.android.REMOTE_JOB_CHANGED"
    const val EXTRA_JOB = "job"
    const val EXTRA_EVENT = "event"
    private const val FILE = "slopcode.remote.jobs"
    private const val JOBS = "jobs.v1"
    private const val FCM_TOKEN = "fcm.token"
    private const val MAX_JOBS = 64
    private const val MAX_TOKEN_LENGTH = 4096
  }
}
