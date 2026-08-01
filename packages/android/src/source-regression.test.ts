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
    const manifest = await Bun.file(`${root}/app/src/main/AndroidManifest.xml`).text()

    expect(activity).toContain("WebViewCompat.addWebMessageListener")
    expect(activity).toContain("setOf(TRUSTED_ORIGIN)")
    expect(activity).toContain("shouldOverrideUrlLoading")
    expect(activity).toContain("ActivityResultContracts.RequestPermission()")
    expect(activity).not.toContain("addJavascriptInterface(")
    expect(manifest).not.toContain('android:usesCleartextTraffic="true"')
    expect(bridge).toContain('return url.takeIf { it.protocol == "https" }')
    expect(bridge).not.toContain("10.0.2.2")
    expect(bridge).not.toContain("127.0.0.1")
    expect(bridge).not.toContain("localhost")
    expect(bridge).toContain('"requestNotificationPermission" -> requestNotificationPermission { state ->')
  })

  test("detects notification denial across upgrades without misclassifying fresh installs", async () => {
    const bridge = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`).text()

    expect(bridge).toContain('getSharedPreferences("slopcode.permission"')
    expect(bridge).toContain('state.getBoolean("notification_requested", false)')
    expect(bridge).toContain("activity.shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS)")
    expect(bridge).toContain("NotificationManagerCompat.from(activity).areNotificationsEnabled()")
    expect(bridge).toContain("info.lastUpdateTime > info.firstInstallTime")
    expect(bridge).toContain('if (requested || rationale) return "denied"')
    expect(bridge).toContain('if (!enabled && upgraded) return "denied"')
    expect(bridge).toContain("Android 13+ keeps notifications off for fresh installs until the first grant")
    expect(bridge).toContain('state.edit().putBoolean("notification_requested", true).apply()')
  })
})
