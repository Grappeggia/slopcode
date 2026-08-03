package dev.slopcode.android

import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

internal fun remoteJobNotificationActions(job: RemoteJobState) = when (job.status) {
  RemoteJobStatus.WAITING_APPROVAL -> listOf(RemoteJobAction.APPROVE, RemoteJobAction.REJECT, RemoteJobAction.STOP)
  RemoteJobStatus.WAITING_QUESTION -> listOf(RemoteJobAction.ANSWER, RemoteJobAction.STOP)
  RemoteJobStatus.FAILED -> listOf(RemoteJobAction.RETRY)
  RemoteJobStatus.QUEUED, RemoteJobStatus.RUNNING, RemoteJobStatus.RETRYING -> listOf(RemoteJobAction.STOP)
  else -> emptyList()
}

internal fun remoteJobNotificationActionAllowed(job: RemoteJobState, action: String) = when (action) {
  RemoteJobAction.APPROVE, RemoteJobAction.REJECT -> job.status == RemoteJobStatus.WAITING_APPROVAL
  RemoteJobAction.ANSWER -> job.status == RemoteJobStatus.WAITING_QUESTION
  RemoteJobAction.STEER, RemoteJobAction.COMMENT -> !RemoteJobStatus.terminal(job.status)
  RemoteJobAction.STOP -> !RemoteJobStatus.terminal(job.status)
  RemoteJobAction.RETRY -> job.status == RemoteJobStatus.FAILED || job.status == RemoteJobStatus.STOPPED
  else -> false
}

internal fun remoteJobActionInteraction(job: RemoteJobState) = listOf(
  job.id,
  job.status,
  job.sessionID.orEmpty(),
  job.approval?.optString("id").orEmpty(),
  job.question?.optString("id").orEmpty(),
).joinToString("\u0000")

internal fun remoteJobActionIdempotencyKey(job: RemoteJobState, action: String) = "action_" +
  MessageDigest.getInstance("SHA-256")
    .digest("${remoteJobActionInteraction(job)}\u0000$action".toByteArray())
    .joinToString("") { "%02x".format(it.toInt() and 0xff) }

internal fun remoteJobActionFailure(job: RemoteJobState, action: String, message: String) = job.copy(
  actionError = "$message. Tap ${action.replaceFirstChar(Char::titlecase)} to retry.",
  retryAction = action,
  updatedAt = System.currentTimeMillis(),
)

internal class RemoteJobActionGate {
  private val active = ConcurrentHashMap.newKeySet<String>()

  fun acquire(job: RemoteJobState, action: String): RemoteJobActionLease? {
    if (!remoteJobNotificationActionAllowed(job, action)) return null
    val interaction = remoteJobActionInteraction(job)
    if (!active.add(interaction)) return null
    return RemoteJobActionLease(interaction, active)
  }
}

internal class RemoteJobActionLease(
  val interaction: String,
  private val active: MutableSet<String>,
) : AutoCloseable {
  override fun close() {
    active.remove(interaction)
  }
}
