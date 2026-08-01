import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

describe("android security source regressions", () => {
  test("keeps the real app mounted on the trusted local asset origin", async () => {
    const entry = await Bun.file(`${root}/src/index.ts`).text()
    const app = await Bun.file(`${root}/src/index-app.tsx`).text()

    expect(entry).toContain("mountAndroidApp")
    expect(app).toContain("AppBaseProviders")
    expect(app).toContain("AppInterface")
    expect(app).toContain("HashRouter")
    expect(app).not.toContain("window.location.replace(")
  })

  test("uses the origin-restricted WebView bridge and blocks cleartext by default", async () => {
    const activity = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/MainActivity.kt`).text()
    const bridge = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`).text()
    const platform = await Bun.file(`${root}/src/platform.ts`).text()
    const remoteState = await Bun.file(`${root}/src/remote-workspace-state.ts`).text()
    const manifest = await Bun.file(`${root}/app/src/main/AndroidManifest.xml`).text()

    expect(activity).toContain("WebViewCompat.addWebMessageListener")
    expect(activity).toContain("setOf(TRUSTED_ORIGIN)")
    expect(activity).toContain("shouldOverrideUrlLoading")
    expect(activity).toContain("onRequestPermissionsResult")
    expect(activity).toContain("grantResults.isEmpty()")
    expect(activity).not.toContain("addJavascriptInterface(")
    expect(manifest).not.toContain('android:usesCleartextTraffic="true"')
    expect(bridge).toContain('if (url.protocol != "https") return null')
    expect(bridge).toContain("url.userInfo != null || url.query != null || url.ref != null")
    expect(bridge).not.toContain("10.0.2.2")
    expect(bridge).not.toContain("127.0.0.1")
    expect(bridge).not.toContain("localhost")
    expect(bridge).toContain('"requestNotificationPermission" -> requestNotificationPermission { state ->')
    expect(platform).toContain("volatileStorage")
    expect(platform).not.toContain("localStorage")
    expect(remoteState).toContain("url.username || url.password || url.search || url.hash")
  })

  test("uses observed OS permission state instead of app package timestamps", async () => {
    const bridge = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`).text()
    const permission = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/NotificationPermission.kt`).text()

    expect(bridge).toContain('getSharedPreferences("slopcode.permission"')
    expect(bridge).toContain('notificationState.getInt("notification_observed_api", -1)')
    expect(bridge).toContain('notificationState.getString("notification_observed_permission", null)')
    expect(bridge).toContain('notificationState.getBoolean("notification_denied", false)')
    expect(bridge).toContain("activity.shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS)")
    expect(bridge).toContain("NotificationManagerCompat.from(activity).areNotificationsEnabled()")
    expect(bridge).not.toContain("lastUpdateTime")
    expect(bridge).not.toContain("firstInstallTime")
    expect(bridge).toContain('if (state != "prompt" || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU)')
    expect(permission).toContain("observedApi")
    expect(permission).toContain("upgradedFromDisabled")
  })
})
