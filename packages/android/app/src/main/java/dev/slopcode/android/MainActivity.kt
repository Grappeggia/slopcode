package dev.slopcode.android

import android.content.Intent
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private lateinit var bridge: AndroidBridge

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
    webView.webChromeClient = WebChromeClient()
    webView.addJavascriptInterface(bridge, "SlopcodeAndroid")
    webView.webViewClient = object : WebViewClientCompat() {
      override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest) =
        loader.shouldInterceptRequest(request.url)

      override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        bridge.flushDeepLinks()
      }
    }

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

  private fun handleIntent(intent: Intent?, flush: Boolean) {
    val links = buildList {
      intent?.dataString?.takeIf(String::isNotBlank)?.let(::add)
      intent?.getStringExtra("notification_href")?.takeIf(String::isNotBlank)?.let(::add)
    }
    if (links.isEmpty()) return
    links.forEach(bridge::enqueueDeepLink)
    if (flush) bridge.flushDeepLinks()
  }
}
