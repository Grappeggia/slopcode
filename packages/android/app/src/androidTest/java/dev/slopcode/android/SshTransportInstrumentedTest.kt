package dev.slopcode.android

import android.os.Bundle
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.jcraft.jsch.HostKey
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.charset.StandardCharsets

@RunWith(AndroidJUnit4::class)
class SshTransportInstrumentedTest {
  @Test
  fun firstUseRequiresTrustAndBothSupportedAuthenticationMethodsWork() {
    val fixture = fixture()
    val store = SshHostKeyStore(context())
    store.remove(fixture.hostKeyName, null)
    val privateKey = transport()
    try {
      val first = privateKey.connect(fixture.connection("privateKey", fixture.privateKey).toString())
      assertEquals("host_key_required", first.optString("status"))
      val fingerprint = first.optString("fingerprint")
      assertTrue("SSH fixture did not provide a host-key fingerprint.", fingerprint.isNotBlank())
      assertEquals(
        "trusted",
        privateKey.trust(JSONObject().put("profile", fixture.profile).put("fingerprint", fingerprint).toString()).optString("status"),
      )
      assertConnected(privateKey.connect(fixture.connection("privateKey", fixture.privateKey).toString()))
    } finally {
      privateKey.close()
    }

    val password = transport()
    try {
      assertConnected(password.connect(fixture.connection("password", password = fixture.password).toString()))
    } finally {
      password.close()
    }
  }

  @Test
  fun sftpListsScopedWorkspaceWithBreadcrumbDataAndHidesDotfilesByDefault() {
    val fixture = fixture()
    val ssh = connected(fixture)
    try {
      val hidden = ssh.list(fixture.directory)
      assertEquals(fixture.directory, hidden.optString("path"))
      assertTrue("SFTP list must include a parent for breadcrumbs.", hidden.optString("parent").startsWith("/"))
      entries(hidden).forEach { entry ->
        assertFalse("Dotfiles must be hidden by default.", entry.optString("name").startsWith("."))
        assertTrue("SFTP entries must remain within the requested parent.", entry.optString("path").startsWith("${fixture.directory}/"))
      }
      assertEquals(fixture.directory, ssh.list(fixture.directory, showHidden = true).optString("path"))
      val invalid = runCatching { ssh.selectWorkspace("$REMOTE_ROOT/../escape") }.exceptionOrNull()
      assertTrue(invalid is SshTransportException)
      assertEquals("invalid_workspace", (invalid as SshTransportException).code)
      assertEquals(fixture.directory, ssh.selectWorkspace(fixture.directory).optString("path"))
    } finally {
      ssh.close()
    }
  }

  @Test
  fun configuredMissingAgentUsesTheAllowlistedInstallChecklist() {
    val fixture = fixture()
    val agent = fixture.setupAgent
    val ssh = connected(fixture)
    val events = events()
    try {
      assertEquals(fixture.directory, ssh.selectWorkspace(fixture.directory).optString("path"))
      val absent = ssh.version(version(agent, fixture))
      assertEquals(
        "The SSH fixture must begin without ${agent.binary}; choose SSH_E2E_SETUP_AGENT accordingly.",
        127,
        absent.optInt("exitCode"),
      )
      val setup = ssh.start(start("install", agent, fixture))
      assertSession(setup)
      assertEquals(0, waitForCompletion(events, setup.optString("id")))
      assertPreflight(ssh, agent, fixture)
      assertLoggedIn(ssh, agent, fixture)
    } finally {
      ssh.close()
    }
  }

  @Test
  fun allFiveAgentsPassPreflightSkipLoginAndCompleteOneShotPrompts() {
    val fixture = fixture()
    val ssh = connected(fixture)
    val events = events()
    try {
      assertEquals(fixture.directory, ssh.selectWorkspace(fixture.directory).optString("path"))
      SshAgent.entries.forEach { agent ->
        assertPreflight(ssh, agent, fixture)
        assertLoggedIn(ssh, agent, fixture)
        val marker = "SSH_E2E_${agent.id.replace("-", "_").uppercase()}_OK"
        val session = ssh.start(
          start(
            "prompt",
            agent,
            fixture,
            "Reply with exactly $marker and then exit. Do not write files or run commands.",
          ),
        )
        assertSession(session)
        waitForOutput(events, session.optString("id"), marker)
        assertEquals("${agent.id} one-shot prompt did not complete successfully.", 0, waitForCompletion(events, session.optString("id")))
      }
    } finally {
      ssh.close()
    }
  }

  @Test
  fun interactivePtyAcceptsInputResizeCtrlCDisconnectAndReconnect() {
    val fixture = fixture()
    val ssh = connected(fixture)
    val events = events()
    try {
      assertEquals(fixture.directory, ssh.selectWorkspace(fixture.directory).optString("path"))
      assertPreflight(ssh, SshAgent.SLOPCODE, fixture)
      val session = ssh.start(start("interactive", SshAgent.SLOPCODE, fixture))
      assertSession(session)
      ssh.resize(100, 30, 0, 0)
      ssh.input("SSH_INTERACTIVE_E2E\\n")
      ssh.interrupt()
      waitForCompletion(events, session.optString("id"))
      ssh.disconnect()
      assertFalse(ssh.status().optBoolean("remoteTransport"))
      assertConnected(ssh.connect(fixture.connection("privateKey", fixture.privateKey).toString()))
      assertEquals(fixture.directory, ssh.selectWorkspace(fixture.directory).optString("path"))
    } finally {
      ssh.close()
    }
  }

  @Test
  fun changedHostKeyIsRejectedWithoutAcceptingTheReplacement() {
    val fixture = fixture()
    val ssh = connected(fixture)
    val store = SshHostKeyStore(context())
    try {
      val known = store.getHostKey(fixture.hostKeyName, null).firstOrNull()
      assertNotNull("The fixture host key was not persisted after confirmation.", known)
      val original = known!!
      val changed = Base64.decode(original.key, Base64.DEFAULT).also { bytes ->
        bytes[bytes.lastIndex] = (bytes[bytes.lastIndex].toInt() xor 1).toByte()
      }
      store.trust(HostKey(fixture.hostKeyName, changed))
      try {
        val error = runCatching { ssh.connect(fixture.connection("privateKey", fixture.privateKey).toString()) }.exceptionOrNull()
        assertTrue(error is SshTransportException)
        assertEquals("host_key_mismatch", (error as SshTransportException).code)
      } finally {
        store.remove(fixture.hostKeyName, null)
        store.trust(original)
      }
    } finally {
      ssh.close()
    }
  }

  @Test
  fun wrongPasswordIsActionable() {
    val fixture = fixture()
    val ssh = transport()
    try {
      val error = runCatching {
        ssh.connect(fixture.connection("password", password = "invalid-password-for-e2e").toString())
      }.exceptionOrNull()
      assertTrue(error is SshTransportException)
      assertEquals("authentication_failed", (error as SshTransportException).code)
    } finally {
      ssh.close()
    }
  }

  @Test
  fun configuredHostPersistsCredentialsBeforeProcessDeath() {
    val fixture = fixture()
    val ssh = transport()
    try {
      assertConnected(ssh.connect(fixture.connection("privateKey", fixture.privateKey, save = true).toString()))
      assertNotNull("Fixture credentials were not persisted to Keystore-backed storage.", ssh.credentials.get(fixture.profile))
    } finally {
      ssh.close()
    }
  }

  @Test
  fun storedCredentialsReconnectAfterProcessDeath() {
    val fixture = fixture()
    val ssh = transport()
    try {
      assertNotNull(
        "No persisted fixture credentials were found. Run configuredHostPersistsCredentialsBeforeProcessDeath before this test.",
        ssh.credentials.get(fixture.profile),
      )
      assertConnected(ssh.connect(fixture.storedConnection().toString()))
      assertEquals(fixture.directory, ssh.selectWorkspace(fixture.directory).optString("path"))
      ssh.credentials.clear(fixture.profile)
    } finally {
      ssh.close()
    }
  }

  @Test
  fun networkLossFailsClosedWhenTheHarnessHasDisabledNetworking() {
    val fixture = fixture()
    if (arguments().getString("sshNetworkLoss") != "true") return
    val ssh = transport()
    try {
      val error = runCatching { ssh.connect(fixture.connection("privateKey", fixture.privateKey).toString()) }.exceptionOrNull()
      assertTrue(
        "The emulator still reached the SSH fixture while the harness declared networking disabled.",
        error is SshTransportException,
      )
      assertEquals("network_error", (error as SshTransportException).code)
    } finally {
      ssh.close()
    }
  }

  private fun fixture(): Fixture {
    val args = arguments()
    val missing = listOf("sshE2E", "sshHost", "sshUser", "sshPort", "sshDirectory", "sshPrivateKeyFile", "sshPasswordFile", "sshSetupAgent")
      .filter { args.getString(it).isNullOrBlank() }
    if (missing.isNotEmpty()) {
      fixtureError(
        "Live SSH E2E is not configured. Run packages/android/scripts/run-ssh-e2e-all-agents.sh with protected SSH_HOST, SSH_USER, SSH_KEY_FILE, SSH_PASSWORD_FILE, SSH_E2E_SETUP_AGENT, and SSH_E2E_ALLOW_INSTALL=1. Missing: ${missing.joinToString(", ")}. Secrets are intentionally not accepted as test arguments.",
      )
    }
    if (args.getString("sshE2E") != "true") fixtureError("Live SSH E2E requires sshE2E=true from the harness.")
    val directory = args.getString("sshDirectory")!!.trim()
    if (directory != REMOTE_ROOT) fixtureError("Live SSH E2E may only use $REMOTE_ROOT; received an unsupported remote directory.")
    val port = args.getString("sshPort")!!.toIntOrNull()?.takeIf { it in 1..65_535 }
      ?: fixtureError("Live SSH E2E requires a valid sshPort.")
    val agent = SshAgent.parse(args.getString("sshSetupAgent"))
      ?: fixtureError("SSH_E2E_SETUP_AGENT must name one of the five allowlisted agents.")
    if (args.getString("sshAllowInstall") != "true") {
      fixtureError("Live SSH E2E requires explicit sshAllowInstall=true because it exercises the selected CLI's documented installer.")
    }
    val host = args.getString("sshHost")!!.trim()
    val user = args.getString("sshUser")!!.trim()
    if (!validHost(host) || !validUser(user)) fixtureError("Live SSH E2E host or user is invalid.")
    return Fixture(
      host = host,
      port = port,
      user = user,
      directory = directory,
      privateKey = secret(args, "sshPrivateKeyFile"),
      password = secret(args, "sshPasswordFile").trimEnd('\r', '\n'),
      setupAgent = agent,
    )
  }

  private fun secret(args: Bundle, field: String): String {
    val name = args.getString(field)?.trim().orEmpty()
    if (!SAFE_FIXTURE_FILE.matches(name)) fixtureError("Live SSH E2E $field must reference a staged fixture file.")
    val root = File(context().filesDir, FIXTURE_DIR).canonicalFile
    val file = File(root, name).canonicalFile
    if (!file.path.startsWith("${root.path}/") || !file.isFile) {
      fixtureError("Live SSH E2E fixture file for $field is missing. Re-run the harness to stage protected inputs.")
    }
    return file.readText(StandardCharsets.UTF_8).takeIf(String::isNotBlank)
      ?: fixtureError("Live SSH E2E fixture file for $field is empty.")
  }

  private fun connected(fixture: Fixture): SshTransport {
    val ssh = transport()
    assertConnected(ssh.connect(fixture.connection("privateKey", fixture.privateKey).toString()))
    return ssh
  }

  private fun transport(): SshTransport = SshTransport(context()) { event ->
    synchronized(eventBuffer) { eventBuffer += JSONObject(event.toString()) }
  }

  private fun events(): MutableList<JSONObject> {
    synchronized(eventBuffer) { eventBuffer.clear() }
    return eventBuffer
  }

  private fun version(agent: SshAgent, fixture: Fixture) = JSONObject()
    .put("agent", agent.id)
    .put("directory", fixture.directory)
    .toString()

  private fun start(operation: String, agent: SshAgent, fixture: Fixture, prompt: String? = null) = JSONObject()
    .put("operation", operation)
    .put("agent", agent.id)
    .put("directory", fixture.directory)
    .apply { prompt?.let { put("prompt", it) } }
    .toString()

  private fun assertPreflight(ssh: SshTransport, agent: SshAgent, fixture: Fixture) {
    val result = ssh.version(version(agent, fixture))
    assertTrue("${agent.id} preflight failed with exit code ${result.optInt("exitCode")}; install and PATH must be fixed on the fixture.", result.optBoolean("ok"))
  }

  private fun assertLoggedIn(ssh: SshTransport, agent: SshAgent, fixture: Fixture) {
    val result = ssh.authStatus(version(agent, fixture))
    assertTrue("${agent.id} authentication status failed with exit code ${result.optInt("exitCode")}; complete login on the fixture.", result.optBoolean("ok"))
    assertTrue("${agent.id} is not logged in; the Android setup UI must show setup instead of silently starting a turn.", result.optBoolean("loggedIn"))
  }

  private fun assertSession(value: JSONObject) {
    assertEquals("started", value.optString("status"))
    assertTrue(value.optString("id").matches(Regex("ssh_[A-Za-z0-9]+")))
  }

  private fun assertConnected(value: JSONObject) {
    assertEquals("connected", value.optString("status"))
    assertTrue(value.optBoolean("remoteTransport"))
  }

  private fun entries(value: JSONObject) = (0 until value.optJSONArray("entries").safeLength())
    .mapNotNull { index -> value.optJSONArray("entries")?.optJSONObject(index) }

  private fun JSONArray?.safeLength() = this?.length() ?: 0

  private fun waitForCompletion(events: MutableList<JSONObject>, id: String): Int = waitFor(events, id) {
    it.optString("type") == "completed"
  }.optInt("exitCode", -1)

  private fun waitForOutput(events: MutableList<JSONObject>, id: String, marker: String) {
    waitFor(events, id) { event ->
      event.optString("type") == "output" && event.optString("data").contains(marker)
    }
  }

  private fun waitFor(events: MutableList<JSONObject>, id: String, predicate: (JSONObject) -> Boolean): JSONObject {
    val deadline = System.currentTimeMillis() + SESSION_TIMEOUT_MS
    while (System.currentTimeMillis() < deadline) {
      synchronized(events) {
        events.firstOrNull { it.optString("id") == id && predicate(it) }?.let { return it }
      }
      Thread.sleep(100)
    }
    throw AssertionError("SSH E2E session did not produce the expected sanitized event before timeout.")
  }

  private fun arguments() = InstrumentationRegistry.getArguments()

  private fun context() = InstrumentationRegistry.getInstrumentation().targetContext

  private fun fixtureError(message: String): Nothing = throw AssertionError(message)

  private data class Fixture(
    val host: String,
    val port: Int,
    val user: String,
    val directory: String,
    val privateKey: String,
    val password: String,
    val setupAgent: SshAgent,
  ) {
    val profile = canonicalProfile(user, host, port)
    val hostKeyName = if (port == 22) host else "[$host]:$port"

    fun connection(auth: String, privateKey: String? = null, password: String? = null, save: Boolean = false) = JSONObject()
      .put("profile", profile)
      .put("host", host)
      .put("port", port)
      .put("username", user)
      .put("directory", directory)
      .put("auth", auth)
      .put("saveCredentials", save)
      .apply {
        privateKey?.let { put("privateKey", it) }
        password?.let { put("password", it) }
      }

    fun storedConnection() = JSONObject()
      .put("profile", profile)
      .put("host", host)
      .put("port", port)
      .put("username", user)
      .put("directory", directory)
      .put("saveCredentials", false)
  }

  companion object {
    private const val REMOTE_ROOT = "/home/agent/temp"
    private const val FIXTURE_DIR = "ssh-e2e"
    private const val SESSION_TIMEOUT_MS = 120_000L
    private val SAFE_FIXTURE_FILE = Regex("[A-Za-z0-9._-]{1,96}")
    private val eventBuffer = mutableListOf<JSONObject>()
  }
}
