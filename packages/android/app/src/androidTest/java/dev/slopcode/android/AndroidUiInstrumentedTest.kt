package dev.slopcode.android

import android.webkit.WebView
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class AndroidUiInstrumentedTest {
  @After
  fun clearWorkspace() {
    preferences().edit().clear().commit()
  }

  @Test
  fun savedComputerAndAddComputerAreRenderedAsAccessibleTouchControls() {
    preferences().edit().putString(SSH_WORKSPACE_KEY, savedWorkspace()).commit()
    launch().use { scenario ->
      waitFor(scenario) { snapshot(scenario).optString("text").contains("Your computers") }
      val first = snapshot(scenario)
      assertTrue(first.optString("text").contains("fixture.test"))
      assertTrue(first.optString("text").contains("Add computer"))
      assertTrue(first.getJSONObject("buttons").getJSONObject("add").getInt("height") >= 48)
      assertTrue(first.getJSONObject("buttons").getJSONObject("add").getInt("width") >= 48)
      assertSemantic(scenario, "Open navigation")

      assertTrue(click(scenario, "Add computer"))
      waitFor(scenario) { snapshot(scenario).optBoolean("address") }
      val next = snapshot(scenario)
      assertTrue(next.optString("text").contains("Advanced connection details"))
      assertTrue(next.getJSONObject("buttons").getJSONObject("menu").getInt("height") >= 48)
      assertSemantic(scenario, "Open navigation")
    }
  }

  @Test
  fun renderedOnboardingExposesHiddenFilesAgentSetupAndThemeLayout() {
    launch(fakeBridge = true).use { scenario ->
      waitFor(scenario) { snapshot(scenario).optBoolean("address") }
      assertTrue(input(scenario, "input[placeholder='user@mac.example.com']", "agent@fixture.test"))
      assertTrue(click(scenario, "Continue"))
      waitFor(scenario) { snapshot(scenario).optBoolean("password") }
      assertTrue(input(scenario, "input[type='password']", "test-password"))
      assertTrue(click(scenario, "Connect to SSH host"))
      waitFor(scenario) { snapshot(scenario).getJSONObject("buttons").getJSONObject("folder").getInt("height") > 0 }

      val folder = snapshot(scenario)
      assertFalse(folder.optBoolean("hidden"))
      assertFalse(folder.optString("text").contains(".fixture-hidden"))
      assertTrue(folder.getJSONObject("buttons").getJSONObject("folder").getInt("height") >= 48)
      assertTrue(toggleHidden(scenario))
      waitFor(scenario) { snapshot(scenario).optString("text").contains(".fixture-hidden") }
      assertSemantic(scenario, "Show hidden files")

      assertTrue(click(scenario, "Use this folder"))
      waitFor(scenario) { snapshot(scenario).optString("text").contains("Choose the backend agent") }
      val agents = snapshot(scenario).optString("text")
      listOf("Slopcode", "Codex", "OpenCode", "Claude Code", "Antigravity").forEach { assertTrue(agents.contains(it)) }
      assertTrue(agents.contains("Ready"))
      assertTrue(agents.contains("Not installed"))
      assertTrue(click(scenario, "Codex"))
      assertTrue(click(scenario, "Run preflight and open agent"))
      waitFor(scenario) { snapshot(scenario).optString("text").contains("Codex is not installed") }
      assertTrue(snapshot(scenario).optString("text").contains("Installing"))
      assertTrue(snapshot(scenario).optString("text").contains("Signing in"))

      assertTrue(click(scenario, "Open navigation"))
      waitFor(scenario) { snapshot(scenario).optString("text").contains("Use dark theme") }
      assertTrue(click(scenario, "Use dark theme"))
      waitFor(scenario) { snapshot(scenario).optString("theme") == "dark" }
      val dark = snapshot(scenario)
      assertEquals("dark", dark.optString("theme"))
      assertFalse(dark.optString("canvas").equals(dark.optString("textColor"), ignoreCase = true))

      assertSemantic(scenario, "Open navigation")
    }
  }

  private fun launch(fakeBridge: Boolean = false): ActivityScenario<MainActivity> {
    val scenario = ActivityScenario.launch(MainActivity::class.java)
    if (!fakeBridge) return scenario
    scenario.onActivity { activity ->
      assertTrue("The packaged WebView does not support document-start UI test fixtures.", WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
      val web = activity.findViewById<WebView>(R.id.webview)
      script = WebViewCompat.addDocumentStartJavaScript(web, fake(), setOf(ORIGIN))
      web.reload()
    }
    return scenario
  }

  private fun snapshot(scenario: ActivityScenario<MainActivity>): JSONObject = JSONObject(
    string(
      evaluate(
        scenario,
        """
        (() => {
          const find = (text) => [...document.querySelectorAll('button')].find((item) => item.innerText.trim() === text)
          const box = (item) => {
            if (!item) return { width: 0, height: 0, top: -1, bottom: -1 }
            const rect = item.getBoundingClientRect()
            return { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom) }
          }
          const hidden = document.querySelector("input[type='checkbox']")
          const shell = document.querySelector('[data-ssh-shell]')
          const root = document.documentElement
          return JSON.stringify({
            text: document.body?.innerText || '',
            address: !!document.querySelector("input[placeholder='user@mac.example.com']"),
            password: !!document.querySelector("input[type='password']"),
            hidden: !!hidden?.checked,
            theme: shell?.getAttribute('data-ssh-theme') || '',
            canvas: getComputedStyle(shell || root).backgroundColor,
            textColor: getComputedStyle(document.querySelector('main') || root).color,
            landscape: matchMedia('(orientation: landscape)').matches,
            height: Math.round(visualViewport?.height || innerHeight),
            buttons: { add: box(find('Add computer')), menu: box(document.querySelector('[data-ssh-menu-toggle]')), folder: box(find('Use this folder')), primary: box(find('Run preflight and open agent') || find('Install the agent above') || find('Continue') || find('Connect to SSH host')) }
          })
        })()
        """.trimIndent(),
      ),
    ),
  )

  private fun click(scenario: ActivityScenario<MainActivity>, text: String) = evaluate(
    scenario,
    """(() => { const value = ${json(text)}; const item = [...document.querySelectorAll('button')].find((button) => button.innerText.replace(/\s+/g, ' ').trim() === value || button.innerText.includes(value)); if (!item || item.disabled) return JSON.stringify(false); item.click(); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun input(scenario: ActivityScenario<MainActivity>, selector: String, value: String) = evaluate(
    scenario,
    """(() => { const item = document.querySelector(${json(selector)}); if (!(item instanceof HTMLInputElement)) return JSON.stringify(false); item.value = ${json(value)}; item.dispatchEvent(new Event('input', { bubbles: true })); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun toggleHidden(scenario: ActivityScenario<MainActivity>) = evaluate(
    scenario,
    """(() => { const details = [...document.querySelectorAll('details')].find((item) => item.querySelector('summary')?.innerText.trim() === 'More'); const item = details?.querySelector("input[type='checkbox']"); if (!(item instanceof HTMLInputElement)) return JSON.stringify(false); details.open = true; item.checked = true; item.dispatchEvent(new Event('change', { bubbles: true })); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun evaluate(scenario: ActivityScenario<MainActivity>, code: String): String {
    val result = AtomicReference<String>()
    val latch = CountDownLatch(1)
    scenario.onActivity { activity ->
      activity.findViewById<WebView>(R.id.webview).evaluateJavascript(code) {
        result.set(it)
        latch.countDown()
      }
    }
    assertTrue("Timed out waiting for rendered WebView DOM.", latch.await(10, TimeUnit.SECONDS))
    return result.get()
  }

  private fun waitFor(scenario: ActivityScenario<MainActivity>, predicate: () -> Boolean) {
    val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(12)
    while (System.nanoTime() < end) {
      if (predicate()) return
      Thread.sleep(100)
    }
    throw AssertionError("Timed out waiting for rendered Android UI state: ${snapshot(scenario)}")
  }

  private fun assertSemantic(scenario: ActivityScenario<MainActivity>, label: String) {
    val result = JSONObject(
      string(
        evaluate(
          scenario,
          """(() => { const item = [...document.querySelectorAll('[aria-label]')].find((node) => node.getAttribute('aria-label') === ${json(label)}); if (!item) return JSON.stringify({ exists: false }); const rect = item.getBoundingClientRect(); return JSON.stringify({ exists: true, visible: rect.width > 0 && rect.height > 0, label: item.getAttribute('aria-label') }); })()""",
        ),
      ),
    )
    assertTrue("No rendered semantic control found for $label.", result.optBoolean("exists"))
    assertTrue("$label is not visible in the rendered UI.", result.optBoolean("visible"))
    assertEquals(label, result.optString("label"))
  }

  private fun preferences() = EncryptedSharedPreferences.create(
    context(),
    "slopcode.slopcode.android.remote.dat",
    MasterKey.Builder(context()).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  private fun savedWorkspace() = JSONObject()
    .put("version", 1)
    .put("target", "agent@fixture.test")
    .put("profile", "agent@fixture.test:22")
    .put("host", "fixture.test")
    .put("port", 22)
    .put("username", "agent")
    .put("directory", "/home/agent/temp")
    .put("agent", "slopcode-cli")
    .put("recentTargets", JSONArray().put("agent@fixture.test"))
    .put("recentFolders", JSONArray().put("/home/agent/temp"))
    .toString()

  private fun fake() = """
    (() => {
      const values = new Map();
      let connected = false;
      let profile = '';
      const reply = (port, id, result) => queueMicrotask(() => port.onmessage?.({ data: JSON.stringify({ id, ok: true, result }) }));
      const listing = (path, hidden) => ({
        path,
        parent: path === '/home/agent/temp' ? '/home/agent' : '/home/agent/temp',
        entries: [
          { name: 'src', path: path + '/src', type: 'directory' },
          { name: 'README.md', path: path + '/README.md', type: 'file', size: 12 },
          ...(hidden ? [{ name: '.fixture-hidden', path: path + '/.fixture-hidden', type: 'file', size: 1 }] : [])
        ]
      });
      const port = {
        onmessage: null,
        postMessage(raw) {
          const request = JSON.parse(raw);
          const args = request.args || [];
          const call = ['sshConnect', 'sshExec', 'sshAuthStatus', 'sshStart', 'sshOrchestratorStart'].includes(request.method) ? JSON.parse(args[0] || '{}') : {};
          let result = null;
          if (request.method === 'capabilities') result = { secureStorage: true, qrPairing: false, notifications: false, deepLinks: false, remoteTransport: true, backgroundExecution: false, remoteJobs: false };
          if (request.method === 'storageGet') result = values.get(args[0] + ':' + args[1]) || null;
          if (request.method === 'storageSet') { values.set(args[0] + ':' + args[1], args[2]); result = null; }
          if (request.method === 'storageRemove') { values.delete(args[0] + ':' + args[1]); result = null; }
          if (request.method === 'storageClear') { values.clear(); result = null; }
          if (request.method === 'storageKeys') result = [];
          if (request.method === 'storageLength') result = 0;
          if (request.method === 'sshEventsReady') result = true;
          if (request.method === 'sshStatus') result = { connected, remoteTransport: connected, ...(connected ? { profile } : {}) };
          if (request.method === 'sshConnect') { profile = call.profile; connected = true; result = { status: 'connected', profile, host: call.host, port: call.port, remoteTransport: true }; }
          if (request.method === 'sshDisconnect' || request.method === 'sshCleanup') { connected = false; result = null; }
          if (request.method === 'sshHome') result = { path: '/home/agent/temp' };
          if (request.method === 'sshList') result = listing(args[0], args[1] === true);
          if (request.method === 'sshSelectWorkspace') result = { path: args[0] };
          if (request.method === 'sshCredentialGet') result = null;
          if (request.method === 'sshCredentialSet' || request.method === 'sshCredentialClear' || request.method === 'setSystemBars') result = null;
          if (request.method === 'sshExec') {
            const missing = call.agent === 'codex-cli' || call.agent === 'antigravity-cli';
            result = { agent: call.agent, executable: call.agent, exitCode: missing ? 127 : 0, output: missing ? 'not found' : 'ready', ok: !missing };
          }
          if (request.method === 'sshAuthStatus') result = { agent: call.agent, executable: call.agent, exitCode: 0, output: call.agent === 'opencode-cli' ? 'sign in required' : 'signed in', ok: true, loggedIn: call.agent !== 'opencode-cli' };
          if (request.method === 'deepLinksReady' || request.method === 'remoteJobsReady') result = true;
          if (request.method === 'consumeDeepLinks' || request.method === 'remoteJobList') result = [];
          reply(port, request.id, result);
        }
      };
      Object.defineProperty(window, 'SlopcodeAndroid', { configurable: true, value: port });
    })();
  """.trimIndent()

  private fun string(value: String) = JSONArray("[$value]").getString(0)

  private fun json(value: String) = JSONObject.quote(value)

  private fun context() = InstrumentationRegistry.getInstrumentation().targetContext

  companion object {
    private const val ORIGIN = "https://appassets.androidplatform.net"
    private const val SSH_WORKSPACE_KEY = "ssh.workspace.v1"
    private var script: ScriptHandler? = null
  }
}
