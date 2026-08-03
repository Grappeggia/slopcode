package dev.slopcode.android

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
