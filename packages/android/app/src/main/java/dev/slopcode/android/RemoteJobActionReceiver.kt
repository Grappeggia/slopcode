package dev.slopcode.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

internal class RemoteJobActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val jobID = intent.getStringExtra(EXTRA_JOB_ID) ?: return
    val action = intent.getStringExtra(EXTRA_ACTION) ?: return
    RemoteJobService.action(context, jobID, action)
  }

  companion object {
    const val EXTRA_JOB_ID = "jobID"
    const val EXTRA_ACTION = "action"
  }
}
