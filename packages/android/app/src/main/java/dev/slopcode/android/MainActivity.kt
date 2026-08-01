package dev.slopcode.android

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private lateinit var bridge: AndroidBridge
  private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
    bridge.onNotificationPermissionResult(granted)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webview)
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

      override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        if (isTrustedAppUrl(Uri.parse(url))) bridge.flushDeepLinks()
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
    notifications.launch(android.Manifest.permission.POST_NOTIFICATIONS)
  }

  private fun handleIntent(intent: Intent?, flush: Boolean) {
    val links = buildList {
      intent?.dataString?.takeIf(String::isNotBlank)?.let(::add)
      intent?.getStringExtra("notification_href")?.takeIf(String::isNotBlank)?.let(::add)
    }
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
  }
}
