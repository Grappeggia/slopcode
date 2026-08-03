package dev.slopcode.android

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

internal data class RemoteJobPushWake(val jobID: String?, val cursor: String?)

internal fun remoteJobPushWake(data: Map<String, String>) = RemoteJobPushWake(
  jobID = data["job_id"] ?: data["jobID"],
  cursor = data["cursor"]?.takeIf { it.length in 1..256 && !it.any(Char::isISOControl) },
)

internal class RemoteJobPushService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val wake = remoteJobPushWake(message.data)
    RemoteJobService.wake(this, wake.jobID)
  }

  override fun onNewToken(token: String) {
    RemoteJobStore(this).setFcmToken(token)
    RemoteJobService.wake(this)
  }
}
