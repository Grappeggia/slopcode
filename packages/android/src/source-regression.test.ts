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
    const manifest = await Bun.file(`${root}/app/src/main/AndroidManifest.xml`).text()

    expect(activity).toContain("WebViewCompat.addWebMessageListener")
    expect(activity).toContain("setOf(TRUSTED_ORIGIN)")
    expect(activity).toContain("shouldOverrideUrlLoading")
    expect(activity).not.toContain("addJavascriptInterface(")
    expect(manifest).not.toContain('android:usesCleartextTraffic="true"')
  })
})
