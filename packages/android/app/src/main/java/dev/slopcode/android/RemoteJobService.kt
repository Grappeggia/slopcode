package dev.slopcode.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal class RemoteJobService : Service() {
  private lateinit var store: RemoteJobStore
  private lateinit var http: RemoteJobHttp
  private val executor = Executors.newCachedThreadPool()
  private val active = ConcurrentHashMap.newKeySet<String>()
  private val actions = RemoteJobActionGate()

  override fun onCreate() {
    super.onCreate()
    store = RemoteJobStore(this)
    http = RemoteJobHttp()
    createChannels()
    startForegroundCompat(summaryNotification())
    store.list()
      .filter { !RemoteJobStatus.terminal(it.status) }
      .forEach { schedule(it.id) }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START, ACTION_WAKE -> {
        val id = intent.getStringExtra(EXTRA_JOB_ID)
        if (id != null) schedule(id) else store.list().filter { !RemoteJobStatus.terminal(it.status) }.forEach { schedule(it.id) }
      }
      ACTION_ACTION -> {
        val id = intent.getStringExtra(EXTRA_JOB_ID)
        val action = intent.getStringExtra(EXTRA_ACTION)
        val payload = intent.getStringExtra(EXTRA_PAYLOAD)?.let { runCatching { org.json.JSONObject(it) }.getOrNull() }
        if (id != null && action != null) scheduleAction(id, action, payload)
      }
    }
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    if (store.list().any { !RemoteJobStatus.terminal(it.status) }) {
      startForegroundCompat(summaryNotification())
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    executor.shutdownNow()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun schedule(id: String) {
    if (!active.add(id)) return
    executor.execute {
      try {
        runJob(id)
      } finally {
        active.remove(id)
        if (store.list().none { !RemoteJobStatus.terminal(it.status) }) stopSelf()
      }
    }
  }

  private fun scheduleAction(id: String, action: String, payload: org.json.JSONObject? = null) {
    if (!RemoteJobAction.valid(action)) return
    executor.execute {
      val job = store.get(id) ?: return@execute
      val lease = actions.acquire(job, action) ?: return@execute
      lease.use {
        val current = store.get(id) ?: return@use
        if (lease.interaction != remoteJobActionInteraction(current) || !remoteJobNotificationActionAllowed(current, action)) return@use
        if (action == RemoteJobAction.STOP) {
          val accepted = runCatching { http.action(current, action, payload) }.getOrDefault(false)
          if (!accepted) {
            store.update(id, event(id, "job.stop_failed", mapOf("message" to "Remote stop request failed"))) {
              remoteJobActionFailure(it, action, "Remote stop request failed")
            }?.let(::notifyJob)
            return@use
          }
          store.update(id, event(id, "job.stopped", mapOf("message" to "Stopped by user"))) {
            it.copy(
              status = RemoteJobStatus.STOPPED,
              error = "Stopped by user",
              actionError = null,
              retryAction = null,
              updatedAt = System.currentTimeMillis(),
            )
          }?.let(::notifyJob)
          return@use
        }
        val accepted = runCatching { http.action(current, action, payload) }.getOrDefault(false)
        if (!accepted) {
          store.update(id, event(id, "job.failed", mapOf("error" to "Remote action failed"))) {
            it.copy(status = RemoteJobStatus.FAILED, error = "Remote action failed", updatedAt = System.currentTimeMillis())
          }?.let(::notifyJob)
          return@execute
        }
        if (action == RemoteJobAction.RETRY) {
          store.update(id, event(id, "job.retry", mapOf("message" to "Retrying remote job"))) {
            it.copy(
              status = RemoteJobStatus.RETRYING,
              started = true,
              error = null,
              actionError = null,
              retryAction = null,
              approval = null,
              question = null,
              updatedAt = System.currentTimeMillis(),
            )
          }?.let(::notifyJob)
          schedule(id)
          return@execute
        }
        store.update(id, event(id, "job.progress", mapOf("message" to "Remote action accepted"))) {
          it.copy(
            status = RemoteJobStatus.RUNNING,
            approval = null,
            question = null,
            actionError = null,
            retryAction = null,
            updatedAt = System.currentTimeMillis(),
          )
        }?.let(::notifyJob)
        schedule(id)
      }
    }
  }

  private fun runJob(id: String) {
    var job = store.get(id) ?: return
    if (RemoteJobStatus.terminal(job.status)) return
    if (job.started) {
      stream(job)
      return
    }
    job = store.update(id, event(id, "job.progress", mapOf("message" to "Starting remote agent"))) {
      it.copy(
        status = RemoteJobStatus.RUNNING,
        attempts = it.attempts + 1,
        started = true,
        updatedAt = System.currentTimeMillis(),
      )
    } ?: return
    notifyJob(job)

    try {
      when (val result = http.start(job, store.fcmToken())) {
        is RemoteJobStartResult.Immediate -> {
          val type = if (result.status == RemoteJobStatus.COMPLETED) "job.completed" else "job.failed"
          val updated = store.update(id, event(id, type, buildMap {
            put("output", result.output)
            result.error?.let { put("error", it) }
          })) {
            it.copy(
              status = result.status,
              output = result.output.takeLast(MAX_OUTPUT_BYTES),
              error = result.error,
              commandPreview = result.commandPreview,
              review = result.review,
              updatedAt = System.currentTimeMillis(),
            )
          }
          updated?.let(::notifyJob)
        }
        is RemoteJobStartResult.Accepted -> {
          job = store.update(id, event(id, "job.progress", buildMap {
            result.sessionID?.let { put("sessionID", it) }
            result.cursor?.let { put("cursor", it) }
          })) {
            it.copy(
              status = RemoteJobStatus.RUNNING,
              sessionID = result.sessionID ?: it.sessionID,
              cursor = result.cursor ?: it.cursor,
              updatedAt = System.currentTimeMillis(),
            )
          } ?: return
          notifyJob(job)
          stream(job)
        }
      }
    } catch (cause: Throwable) {
      val message = cause.message?.take(MAX_ERROR_BYTES) ?: "Remote job connection failed"
      val updated = store.update(id, event(id, "job.failed", mapOf("error" to message))) {
        it.copy(status = RemoteJobStatus.FAILED, error = message, updatedAt = System.currentTimeMillis())
      }
      updated?.let(::notifyJob)
    }
  }

  private fun stream(initial: RemoteJobState) {
    var job = initial
    var delay = 1_000L
    while (!RemoteJobStatus.terminal(job.status)) {
      val result = try {
        http.stream(job, job.cursor) { event ->
          val updated = store.update(job.id, event) { current -> RemoteJobReducer.apply(current, event) }
          if (updated != null) {
            job = updated
            notifyJob(updated)
          }
          updated != null && !RemoteJobStatus.terminal(updated.status)
        }
      } catch (cause: RemoteJobHttpException) {
        if (cause.status == 401 || cause.status == 403) throw cause
        RemoteJobStreamResult.Disconnected
      }
      job = store.get(job.id) ?: return
      if (RemoteJobStatus.terminal(job.status)) return
      if (result == RemoteJobStreamResult.Unsupported) {
        val updated = store.update(job.id, event(job.id, "job.failed", mapOf("error" to "Remote event channel is unavailable"))) {
          it.copy(status = RemoteJobStatus.FAILED, error = "Remote event channel is unavailable", updatedAt = System.currentTimeMillis())
        }
        updated?.let(::notifyJob)
        return
      }
      Thread.sleep(delay)
      delay = (delay * 2).coerceAtMost(30_000L)
    }
  }

  private fun notifyJob(job: RemoteJobState) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val active = !RemoteJobStatus.terminal(job.status)
    val builder = NotificationCompat.Builder(this, JOB_CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle("${job.agent} remote job")
      .setContentText(job.approval?.optString("title") ?: job.question?.optString("prompt") ?: job.actionError ?: job.error ?: job.output?.takeLast(180) ?: job.status.replace('_', ' '))
      .setContentIntent(openIntent(job))
      .setAutoCancel(!active)
      .setOngoing(active)
      .setOnlyAlertOnce(job.status == RemoteJobStatus.RUNNING)
    job.progress?.let { builder.setProgress(100, (it * 100).toInt().coerceIn(0, 100), false) }
    remoteJobNotificationActions(job).forEach { value ->
      builder.addAction(
        if (value == RemoteJobAction.ANSWER) openAction("Answer", job) else action(value.replaceFirstChar(Char::titlecase), job, value),
      )
    }
    if (RemoteJobStatus.terminal(job.status)) builder.setTimeoutAfter(15 * 60 * 1000L)
    runCatching { manager.notify(notificationID(job.id), builder.build()) }
  }

  private fun action(label: String, job: RemoteJobState, value: String) = NotificationCompat.Action.Builder(
    0,
    label,
    PendingIntent.getBroadcast(
      this,
      (job.id + value).hashCode(),
      Intent(this, RemoteJobActionReceiver::class.java).apply {
        putExtra(RemoteJobActionReceiver.EXTRA_JOB_ID, job.id)
        putExtra(RemoteJobActionReceiver.EXTRA_ACTION, value)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    ),
  ).build()

  private fun openAction(label: String, job: RemoteJobState) = NotificationCompat.Action.Builder(
    0,
    label,
    openIntent(job),
  ).build()

  private fun openIntent(job: RemoteJobState) = PendingIntent.getActivity(
    this,
    job.id.hashCode(),
    Intent(this, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      data = android.net.Uri.parse(remoteJobDeepLink(job))
      putExtra("notification_href", remoteJobDeepLink(job))
    },
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun summaryNotification(): Notification = NotificationCompat.Builder(this, SERVICE_CHANNEL)
    .setSmallIcon(android.R.drawable.stat_sys_download)
    .setContentTitle("Slopcode remote jobs")
    .setContentText("Remote agent work continues in the background")
    .setOngoing(true)
    .setContentIntent(PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
    .build()

  private fun startForegroundCompat(notification: Notification) {
    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(SERVICE_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(SERVICE_NOTIFICATION_ID, notification)
      }
    }
  }

  private fun createChannels() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(SERVICE_CHANNEL, "Remote jobs", NotificationManager.IMPORTANCE_LOW))
    manager.createNotificationChannel(NotificationChannel(JOB_CHANNEL, "Remote job updates", NotificationManager.IMPORTANCE_DEFAULT))
  }

  private fun notificationID(id: String) = id.hashCode().and(0x7FFFFFFF).coerceAtLeast(1)

  private fun event(id: String, type: String, data: Map<String, String>) =
    RemoteJobEvent(null, null, id, type, org.json.JSONObject().apply { data.forEach { (key, value) -> put(key, value) } })

  companion object {
    const val ACTION_START = "dev.slopcode.android.REMOTE_JOB_START"
    const val ACTION_WAKE = "dev.slopcode.android.REMOTE_JOB_WAKE"
    const val ACTION_ACTION = "dev.slopcode.android.REMOTE_JOB_ACTION"
    const val EXTRA_JOB_ID = "jobID"
    const val EXTRA_ACTION = "action"
    const val EXTRA_PAYLOAD = "payload"
    private const val SERVICE_CHANNEL = "slopcode.remote.jobs.service"
    private const val JOB_CHANNEL = "slopcode.remote.jobs"
    private const val SERVICE_NOTIFICATION_ID = 7000
    private const val MAX_OUTPUT_BYTES = 64 * 1024
    private const val MAX_ERROR_BYTES = 2 * 1024

    fun enqueue(context: Context, spec: RemoteJobSpec): RemoteJobState {
      val job = RemoteJobStore(context).start(spec)
      start(context, ACTION_START, job.id)
      return job
    }

    fun wake(context: Context, jobID: String? = null) = start(context, ACTION_WAKE, jobID)

    fun action(context: Context, jobID: String, value: String, payload: String? = null) {
      if (!RemoteJobAction.valid(value)) return
      val intent = Intent(context, RemoteJobService::class.java).apply {
        action = ACTION_ACTION
        putExtra(EXTRA_JOB_ID, jobID)
        putExtra(EXTRA_ACTION, value)
        payload?.let { putExtra(EXTRA_PAYLOAD, it) }
      }
      ContextCompat.startForegroundService(context, intent)
    }

    private fun start(context: Context, action: String, jobID: String?) {
      val intent = Intent(context, RemoteJobService::class.java).apply {
        this.action = action
        jobID?.let { putExtra(EXTRA_JOB_ID, it) }
      }
      ContextCompat.startForegroundService(context, intent)
    }
  }
}
