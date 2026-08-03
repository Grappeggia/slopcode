package dev.slopcode.android

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private lateinit var bridge: AndroidBridge
  @Volatile private var windowInsets = Insets()

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webview)
    installWindowInsets()
    applySystemBars(resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK == android.content.res.Configuration.UI_MODE_NIGHT_YES)
    bridge = AndroidBridge(this, webView)

    val loader = WebViewAssetLoader.Builder()
      .addPathHandler("/site/", WebViewAssetLoader.AssetsPathHandler(this))
      .build()

    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.allowContentAccess = false
    webView.settings.allowFileAccess = false
    webView.settings.allowFileAccessFromFileURLs = false
    webView.settings.allowUniversalAccessFromFileURLs = false
    webView.settings.javaScriptCanOpenWindowsAutomatically = false
    webView.settings.setSupportMultipleWindows(false)
    webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    webView.settings.safeBrowsingEnabled = true
    webView.webChromeClient = WebChromeClient()
    webView.webViewClient = object : WebViewClientCompat() {
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
        loader.shouldInterceptRequest(request.url)

      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        if (isTrustedAppUrl(request.url)) return false
        bridge.openLink(request.url.toString())
        return true
      }

      override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
        super.onPageStarted(view, url, favicon)
        bridge.onRendererNavigation()
      }

      override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
      }
    }

    installBridge()

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (webView.canGoBack()) webView.goBack() else finish()
      }
    })

    handleIntent(intent, false)
    webView.loadUrl(BuildConfig.SLOPCODE_WEB_ENTRY)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntent(intent, true)
  }

  fun pickPrivateKey() {
    startActivityForResult(
      Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "application/octet-stream"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/octet-stream", "text/plain", "application/x-pem-file"))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      },
      PRIVATE_KEY_REQUEST,
    )
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != PRIVATE_KEY_REQUEST) return
    bridge.onPrivateKeyResult(if (resultCode == RESULT_OK) data?.data else null)
  }

  override fun onDestroy() {
    if (::bridge.isInitialized) bridge.close()
    if (::webView.isInitialized) webView.destroy()
    super.onDestroy()
  }

  private fun installBridge() {
    check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      "Origin-restricted WebView bridge is unavailable"
    }
    WebViewCompat.addWebMessageListener(
      webView,
      "SlopcodeAndroid",
      setOf(TRUSTED_ORIGIN),
      bridge.listener(),
    )
  }

  fun requestNotificationPermission() {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) return
    requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST)
  }

  fun applySystemBars(dark: Boolean) {
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
    window.isStatusBarContrastEnforced = false
    window.isNavigationBarContrastEnforced = false
    WindowInsetsControllerCompat(window, webView).apply {
      isAppearanceLightStatusBars = !dark
      isAppearanceLightNavigationBars = !dark
    }
  }

  fun systemInsets(): JSONObject {
    val value = windowInsets
    return JSONObject()
      .put("top", value.top)
      .put("right", value.right)
      .put("bottom", value.bottom)
      .put("left", value.left)
      .put("imeBottom", value.imeBottom)
  }

  private fun installWindowInsets() {
    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, value ->
      val bars = value.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = value.getInsets(WindowInsetsCompat.Type.ime())
      windowInsets = Insets(
        top = bars.top,
        right = bars.right,
        bottom = bars.bottom,
        left = bars.left,
        imeBottom = ime.bottom,
      )
      value
    }
    ViewCompat.requestApplyInsets(webView)
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != NOTIFICATION_PERMISSION_REQUEST) return
    bridge.onNotificationPermissionResult(
      grantResults.size == 1 && grantResults[0] == PackageManager.PERMISSION_GRANTED,
      cancelled = grantResults.isEmpty(),
    )
  }

  private fun handleIntent(intent: Intent?, flush: Boolean) {
    val links = buildList {
      intent?.dataString?.takeIf(String::isNotBlank)?.let(::add)
      intent?.getStringExtra("notification_href")?.takeIf(String::isNotBlank)?.let(::add)
    }.take(MAX_INTENT_LINKS)
    if (links.isEmpty()) return
    links.forEach(bridge::enqueueDeepLink)
    if (flush) bridge.flushDeepLinks()
  }

  private fun isTrustedAppUrl(uri: Uri?) =
    uri?.scheme == "https" && uri.host == TRUSTED_HOST && uri.path?.startsWith(TRUSTED_PATH_PREFIX) == true

  companion object {
    private const val TRUSTED_HOST = "appassets.androidplatform.net"
    private const val TRUSTED_ORIGIN = "https://appassets.androidplatform.net"
    private const val TRUSTED_PATH_PREFIX = "/site/"
    private const val NOTIFICATION_PERMISSION_REQUEST = 1001
    private const val PRIVATE_KEY_REQUEST = 1002
    private const val MAX_INTENT_LINKS = 2
  }

  private data class Insets(
    val top: Int = 0,
    val right: Int = 0,
    val bottom: Int = 0,
    val left: Int = 0,
    val imeBottom: Int = 0,
  )
}
