package dev.slopcode.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

internal class RemoteJobBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (RemoteJobStore(context).list().any { !RemoteJobStatus.terminal(it.status) }) RemoteJobService.wake(context)
  }
}
