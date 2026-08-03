package dev.slopcode.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject
import org.json.JSONArray

class SshModelsTest {
  @Test
  fun `remote paths reject traversal and control characters`() {
    assertEquals("/Users/marcos/Projects", SshPath.normalize("/Users/marcos/Projects"))
    assertNull(SshPath.normalize("/tmp/../etc"))
    assertNull(SshPath.normalize("/tmp//etc"))
    assertNull(SshPath.normalize("/tmp/line\nfeed"))
  }

  @Test
  fun `connector commands are fixed and shell quote the selected folder`() {
    val command = SshCommand.prompt(SshAgent.CODEX, "/Users/marcos/Project's code")
    assertTrue(command.startsWith("cd '") && command.contains("exec \"codex\" \"exec\""))
    assertTrue(command.contains("nodejs/*/bin"))
    assertTrue(command.contains("PATH=\"\u0024PATH:\u0024dir\""))
    assertTrue(command.contains("'\"'\"'"))
    assertTrue(!command.contains("codex run"))
  }

  @Test
  fun `orchestrator runs from the validated workspace with fixed arguments`() {
    val command = SshCommand.orchestrator("/Users/marcos/Project's code")
    assertTrue(command.startsWith("cd '") && command.contains("exec \"slopcode\" \"remote-orchestrator\" \"--stdio\""))
    assertTrue(command.contains("'\"'\"'"))
  }

  @Test
  fun `only allowlisted agents parse`() {
    assertEquals(SshAgent.SLOPCODE, SshAgent.parse("slopcode-cli"))
    assertEquals(SshAgent.CODEX, SshAgent.parse("codex-cli"))
    assertEquals(SshAgent.OPENCODE, SshAgent.parse("opencode-cli"))
    assertEquals(SshAgent.CLAUDE, SshAgent.parse("claude-code"))
    assertEquals(SshAgent.ANTIGRAVITY, SshAgent.parse("antigravity-cli"))
    assertNull(SshAgent.parse("bash"))
  }

  @Test
  fun `setup recipes are fixed and do not accept a command from the request`() {
    assertTrue(SshCommand.install(SshAgent.SLOPCODE, "/tmp/project").contains("exec \"npm\" \"install\" \"-g\" \"slopcode@latest\""))
    assertTrue(SshCommand.install(SshAgent.CODEX, "/tmp/project").contains("exec \"npm\" \"install\" \"-g\" \"@openai/codex\""))
    assertTrue(SshCommand.install(SshAgent.OPENCODE, "/tmp/project").contains("exec \"npm\" \"install\" \"-g\" \"opencode-ai\""))
    assertTrue(SshCommand.install(SshAgent.CLAUDE, "/tmp/project").contains("exec \"npm\" \"install\" \"-g\" \"@anthropic-ai/claude-code\""))
    assertTrue(SshCommand.install(SshAgent.ANTIGRAVITY, "/tmp/project").contains("curl -fsSL https://antigravity.google/cli/install.sh | bash"))
    assertTrue(SshCommand.login(SshAgent.SLOPCODE, "/tmp/project").contains("exec \"slopcode\" \"auth\" \"login\""))
    assertTrue(SshCommand.login(SshAgent.CODEX, "/tmp/project").contains("exec \"codex\" \"login\""))
    assertTrue(SshCommand.login(SshAgent.OPENCODE, "/tmp/project").contains("exec \"opencode\" \"auth\" \"login\""))
    assertTrue(SshCommand.login(SshAgent.CLAUDE, "/tmp/project").contains("exec \"claude\""))
    assertTrue(SshCommand.login(SshAgent.ANTIGRAVITY, "/tmp/project").contains("exec \"agy\""))
    assertNull(SshStartRequest.parse(JSONObject("""{"operation":"bash","agent":"codex-cli","directory":"/tmp/project"}""")))
  }

  @Test
  fun `setup requests permit only allowlisted install and login actions`() {
    val install = SshStartRequest.parse(JSONObject("""{"operation":"install","agent":"codex-cli","directory":"/tmp/project"}"""))
    val login = SshStartRequest.parse(JSONObject("""{"operation":"login","agent":"opencode-cli","directory":"/tmp/project"}"""))
    assertEquals(SshSetupAction.INSTALL, install?.setup)
    assertEquals(SshSetupAction.LOGIN, login?.setup)
    assertNull(SshStartRequest.parse(JSONObject("""{"operation":"install","agent":"codex-cli","directory":"/tmp/project","prompt":"rm -rf /"}""")))
  }

  @Test
  fun `authentication checks use fixed agent commands and skip known logged in states`() {
    assertTrue(SshCommand.authStatus(SshAgent.CODEX, "/tmp/project").contains("exec \"codex\" \"login\" \"status\""))
    assertTrue(SshCommand.authStatus(SshAgent.CLAUDE, "/tmp/project").contains("exec \"claude\" \"auth\" \"status\""))
    assertTrue(SshCommand.version(SshAgent.ANTIGRAVITY, "/tmp/project").contains("exec \"agy\" \"--version\""))
    assertTrue(SshCommand.authStatus(SshAgent.ANTIGRAVITY, "/tmp/project").contains("exec \"agy\" \"models\""))
    assertTrue(SshAgent.CODEX.loggedIn("Logged in using ChatGPT", 0))
    assertTrue(SshAgent.OPENCODE.loggedIn("4 credentials", 0))
    assertFalse(SshAgent.CLAUDE.loggedIn("{\"loggedIn\":false}", 0))
    assertFalse(SshAgent.SLOPCODE.loggedIn("0 credentials", 0))
    assertFalse(SshAgent.CODEX.loggedIn("Logged in using ChatGPT", 1))
    assertTrue(SshAgent.ANTIGRAVITY.loggedIn("gemini-3.6-flash-high\nclaude-sonnet-4-6\ngpt-oss-120b-medium", 0))
    assertFalse(SshAgent.ANTIGRAVITY.loggedIn("", 0))
    assertFalse(SshAgent.ANTIGRAVITY.loggedIn("authentication failed", 0))
    assertFalse(SshAgent.ANTIGRAVITY.loggedIn("gemini-3.6-flash-high\nerror: login failed", 0))
    assertFalse(SshAgent.ANTIGRAVITY.loggedIn("not-authenticated", 0))
    assertFalse(SshAgent.ANTIGRAVITY.loggedIn("unexpected", 0))
    assertFalse(SshAgent.ANTIGRAVITY.loggedIn("gemini-3.6-flash-high", 1))
  }

  @Test
  fun `Antigravity bridge requests use the allowlisted enum`() {
    assertEquals(
      SshAgent.ANTIGRAVITY,
      SshVersionRequest.parse(JSONObject("""{"agent":"antigravity-cli","directory":"/tmp/project"}"""))?.agent,
    )
    assertEquals(
      SshAgent.ANTIGRAVITY,
      SshStartRequest.parse(JSONObject("""{"operation":"login","agent":"antigravity-cli","directory":"/tmp/project"}"""))?.agent,
    )
    assertNull(SshStartRequest.parse(JSONObject("""{"operation":"login","agent":"antigravity-cli;curl bad","directory":"/tmp/project"}""")))
    assertNull(
      SshStartRequest.parse(
        JSONObject("""{"operation":"install","agent":"antigravity-cli","directory":"/tmp/project","command":"curl --user-provided https://invalid.example/install.sh"}"""),
      ),
    )
  }

  @Test
  fun `connection profiles are bound to the connection authority`() {
    val accepted = SshConnectionRequest.parse(
      JSONObject()
        .put("profile", "marcos@void:22")
        .put("host", "void")
        .put("port", 22)
        .put("username", "marcos")
        .put("directory", "/tmp"),
    )
    assertEquals("marcos@void:22", accepted?.profile)
    assertNull(
      SshConnectionRequest.parse(
        JSONObject()
          .put("profile", "marcos@void:22")
          .put("host", "other-host")
          .put("port", 22)
          .put("username", "marcos")
          .put("directory", "/tmp"),
      ),
    )
    assertEquals(
      "marcos@[2001:db8::1]:22",
      SshConnectionRequest.parse(
        JSONObject()
        .put("profile", "marcos@[2001:db8::1]:22")
          .put("host", "2001:db8::1")
          .put("port", 22)
          .put("username", "marcos")
          .put("directory", "/tmp"),
      )?.profile,
    )
  }

  @Test
  fun `prefetch selects only immediate validated folders and respects the limit`() {
    val entries = JSONArray()
      .put(JSONObject().put("type", "directory").put("path", "/tmp/one"))
      .put(JSONObject().put("type", "file").put("path", "/tmp/file.txt"))
      .put(JSONObject().put("type", "directory").put("path", "/tmp/two"))
      .put(JSONObject().put("type", "directory").put("path", "/tmp/../etc"))
      .put(JSONObject().put("type", "directory").put("path", "/tmp/one/nested"))
    assertEquals(listOf("/tmp/one"), SshPrefetch.directories("/tmp", entries, 1))
    assertEquals(listOf("/tmp/one", "/tmp/two"), SshPrefetch.directories("/tmp", entries))
  }
}
