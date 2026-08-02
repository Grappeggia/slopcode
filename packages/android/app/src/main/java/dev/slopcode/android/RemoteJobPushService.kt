package dev.slopcode.android

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

internal class RemoteJobPushService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val jobID = message.data["job_id"] ?: message.data["jobID"]
    val cursor = message.data["cursor"]?.takeIf { it.length in 1..256 && !it.any(Char::isISOControl) }
    if (jobID != null && cursor != null) {
      RemoteJobStore(this).update(jobID) { it.copy(cursor = cursor, updatedAt = System.currentTimeMillis()) }
    }
    RemoteJobService.wake(this, jobID)
  }

  override fun onNewToken(token: String) {
    RemoteJobStore(this).setFcmToken(token)
    RemoteJobService.wake(this)
  }
}
