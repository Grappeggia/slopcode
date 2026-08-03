package dev.slopcode.android

import org.json.JSONArray
import org.json.JSONObject

internal object SshPath {
  fun normalize(value: String): String? {
    val next = value.trim()
    if (
      !next.startsWith("/") ||
      next.length > MAX_PATH_LENGTH ||
      next.contains("\\") ||
      next.contains("//") ||
      next.any { it == '\u0000' || it == '\r' || it == '\n' || it == '?' || it == '#' } ||
      next.split('/').any { it == "." || it == ".." }
    ) return null
    if (next != "/" && next.endsWith("/")) return null
    return next
  }

  fun child(parent: String, name: String): String? {
    if (name.isEmpty() || name == "." || name == ".." || name.contains('/') || name.contains('\\')) return null
    if (name.any { it == '\u0000' || it == '\r' || it == '\n' }) return null
    return normalize(if (parent == "/") "/$name" else "$parent/$name")
  }

  fun parent(value: String): String? {
    val next = normalize(value) ?: return null
    if (next == "/") return null
    val index = next.lastIndexOf('/')
    return if (index <= 0) "/" else next.substring(0, index)
  }

  private const val MAX_PATH_LENGTH = 4_096
}

internal object SshPrefetch {
  fun directories(parent: String, entries: JSONArray, limit: Int = 8): List<String> {
    if (limit < 1) return emptyList()
    return (0 until entries.length())
      .mapNotNull { index ->
        val entry = entries.optJSONObject(index) ?: return@mapNotNull null
        if (entry.optString("type") != "directory") return@mapNotNull null
        val path = entry.optString("path")
        val normalized = SshPath.normalize(path) ?: return@mapNotNull null
        if (SshPath.parent(normalized) != parent) return@mapNotNull null
        normalized
      }
      .distinct()
      .take(limit)
  }
}

internal enum class SshAgent(
  val id: String,
  val binary: String,
  val promptArgs: List<String>,
  val authArgs: List<String>,
  val installArgs: List<String>,
  val loginArgs: List<String>,
  val installScript: String? = null,
) {
  SLOPCODE("slopcode-cli", "slopcode", listOf("run"), listOf("auth", "list"), listOf("npm", "install", "-g", "slopcode@latest"), listOf("slopcode", "auth", "login")),
  CODEX("codex-cli", "codex", listOf("exec"), listOf("login", "status"), listOf("npm", "install", "-g", "@openai/codex"), listOf("codex", "login")),
  OPENCODE("opencode-cli", "opencode", listOf("run"), listOf("auth", "list"), listOf("npm", "install", "-g", "opencode-ai"), listOf("opencode", "auth", "login")),
  CLAUDE("claude-code", "claude", listOf("-p"), listOf("auth", "status"), listOf("npm", "install", "-g", "@anthropic-ai/claude-code"), listOf("claude")),
  ANTIGRAVITY(
    "antigravity-cli",
    "agy",
    emptyList(),
    listOf("agents"),
    emptyList(),
    listOf("agy"),
    "curl -fsSL https://antigravity.google/cli/install.sh | bash",
  );

  companion object {
    fun parse(value: String?): SshAgent? = entries.firstOrNull { it.id == value }
  }
}

internal enum class SshSetupAction(val id: String) {
  INSTALL("install"),
  LOGIN("login");

  companion object {
    fun parse(value: String?): SshSetupAction? = entries.firstOrNull { it.id == value }
  }
}

internal object SshCommand {
  fun interactive(agent: SshAgent, directory: String) = command(directory, agent.binary)

  fun prompt(agent: SshAgent, directory: String) = command(directory, agent.binary, *agent.promptArgs.toTypedArray())

  fun version(agent: SshAgent, directory: String) = command(directory, agent.binary, "--version")

  fun authStatus(agent: SshAgent, directory: String) = command(directory, agent.binary, *agent.authArgs.toTypedArray())

  fun install(agent: SshAgent, directory: String) = agent.installScript?.let { script(directory, it) }
    ?: command(directory, *agent.installArgs.toTypedArray())

  fun login(agent: SshAgent, directory: String) = command(directory, *agent.loginArgs.toTypedArray())

  fun orchestrator(directory: String) = command(directory, "slopcode", "remote-orchestrator", "--stdio")

  private fun command(directory: String, vararg args: String) = script(directory, "exec ${args.joinToString(" ") { argument(it) }}")

  private fun script(directory: String, value: String) =
    buildString {
      append("cd ")
      append(quote(directory))
      append(" && exec \"\u0024{SHELL:-/bin/sh}\" -lc ")
      append(
        quote(
          "export PATH=\"\u0024HOME/.local/bin:\u0024HOME/.opencode/bin:\u0024HOME/.bun/bin:\u0024HOME/.local/share/pnpm:\u0024PATH\"; " +
            "for dir in \"\u0024HOME\"/.local/share/pnpm/nodejs/*/bin; do [ -d \"\u0024dir\" ] && PATH=\"\u0024PATH:\u0024dir\"; done; " +
            "export PATH; $value",
        ),
      )
    }

  private fun argument(value: String) = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\u0024", "\\\u0024").replace("`", "\\`")}\""

  private fun quote(value: String): String = "'${value.replace("'", "'\"'\"'")}'"
}

internal data class SshConnectionRequest(
  val profile: String,
  val host: String,
  val port: Int,
  val username: String,
  val directory: String,
  val auth: String?,
  val password: String?,
  val privateKey: String?,
  val passphrase: String?,
  val saveCredentials: Boolean,
) {
  companion object {
    fun parse(value: JSONObject): SshConnectionRequest? {
      val host = value.optString("host").trim()
      val port = value.optInt("port", 22)
      val username = value.optString("username").trim()
      val directory = SshPath.normalize(value.optString("directory", "/")) ?: return null
      val auth = value.optString("auth").takeIf(String::isNotEmpty)
      val password = value.optString("password").takeIf(String::isNotEmpty)
      val privateKey = value.optString("privateKey").takeIf(String::isNotEmpty)
      val passphrase = value.optString("passphrase").takeIf(String::isNotEmpty)
      if (!validHost(host) || port !in 1..65_535 || !validUser(username)) return null
      if (auth != null && auth !in setOf("password", "privateKey")) return null
      if (password != null && password.length > MAX_SECRET_LENGTH) return null
      if (privateKey != null && privateKey.toByteArray(Charsets.UTF_8).size > MAX_PRIVATE_KEY_BYTES) return null
      if (passphrase != null && passphrase.length > MAX_SECRET_LENGTH) return null
      val expected = canonicalProfile(username, host, port)
      val profile = value.optString("profile").trim().ifEmpty { expected }
      if (!validProfile(profile) || profile != expected) return null
      return SshConnectionRequest(
        profile = profile,
        host = host,
        port = port,
        username = username,
        directory = directory,
        auth = auth,
        password = password,
        privateKey = privateKey,
        passphrase = passphrase,
        saveCredentials = value.optBoolean("saveCredentials", true),
      )
    }
  }
}

internal data class SshStartRequest(
  val operation: String,
  val agent: SshAgent,
  val directory: String,
  val prompt: String?,
  val setup: SshSetupAction?,
  val cols: Int,
  val rows: Int,
  val width: Int,
  val height: Int,
) {
  companion object {
    fun parse(value: JSONObject): SshStartRequest? {
      val operation = value.optString("operation", "interactive")
      val setup = SshSetupAction.parse(operation)
      if (operation !in setOf("interactive", "prompt") && setup == null) return null
      val agent = SshAgent.parse(value.optString("agent")) ?: return null
      val directory = SshPath.normalize(value.optString("directory", "/")) ?: return null
      val prompt = value.optString("prompt").takeIf(String::isNotEmpty)
      if (prompt != null && prompt.toByteArray(Charsets.UTF_8).size > MAX_PROMPT_BYTES) return null
      val cols = value.optInt("cols", 120).coerceIn(20, 500)
      val rows = value.optInt("rows", 40).coerceIn(4, 200)
      val width = value.optInt("width", 0).coerceIn(0, 8_000)
      val height = value.optInt("height", 0).coerceIn(0, 8_000)
      if (operation == "prompt" && prompt.isNullOrBlank()) return null
      if (setup != null && prompt != null) return null
      if (value.has("command")) return null
      return SshStartRequest(operation, agent, directory, prompt, setup, cols, rows, width, height)
    }
  }
}

internal data class SshVersionRequest(val agent: SshAgent, val directory: String) {
  companion object {
    fun parse(value: JSONObject): SshVersionRequest? {
      val agent = SshAgent.parse(value.optString("agent")) ?: return null
      val directory = SshPath.normalize(value.optString("directory", "/")) ?: return null
      return SshVersionRequest(agent, directory)
    }
  }
}

internal data class SshOrchestratorRequest(val directory: String) {
  companion object {
    fun parse(value: JSONObject): SshOrchestratorRequest? {
      val directory = SshPath.normalize(value.optString("directory", "/")) ?: return null
      return SshOrchestratorRequest(directory)
    }
  }
}

internal data class SshTrustRequest(val profile: String, val fingerprint: String) {
  companion object {
    fun parse(value: JSONObject): SshTrustRequest? {
      val profile = value.optString("profile").trim()
      val fingerprint = value.optString("fingerprint").trim()
      if (!validProfile(profile) || fingerprint.length !in 8..256 || !fingerprint.matches(Regex("[A-Za-z0-9:+/=._-]+"))) return null
      return SshTrustRequest(profile, fingerprint)
    }
  }
}

internal fun validHost(value: String): Boolean {
  if (value.isEmpty() || value.length > 253 || value.any { it == '\u0000' || it == '\r' || it == '\n' }) return false
  if (value.contains(':')) return value.length <= 45 && value.matches(Regex("[0-9A-Fa-f:.]+")) && value.contains(':')
  return value.matches(Regex("[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?")) && !value.contains("..")
}

internal fun validUser(value: String) = value.matches(Regex("[A-Za-z_][A-Za-z0-9._-]{0,63}"))

internal fun canonicalProfile(username: String, host: String, port: Int): String {
  val next = host.lowercase()
  val authority = if (next.contains(":")) "[$next]" else next
  return "$username@$authority:$port"
}

internal fun SshAgent.loggedIn(output: String, exitCode: Int): Boolean {
  if (exitCode != 0) return false
  val value = output.trim()
  if (this == SshAgent.ANTIGRAVITY) {
    if (Regex("\\b(not|no|none|未)\\b.{0,32}\\b(logged|auth|credential)", RegexOption.IGNORE_CASE).containsMatchIn(value)) return false
    return Regex("(?m)^\\s*(?:[-*]|[0-9]+[.)])\\s+\\S|^\\s{2,}\\S").containsMatchIn(value)
  }
  if (value.isEmpty()) return true
  if (Regex("\\\"loggedIn\\\"\\s*:\\s*false", RegexOption.IGNORE_CASE).containsMatchIn(value)) return false
  if (Regex("\\b(not|no|none|未)\\b.{0,32}\\b(logged|auth|credential)", RegexOption.IGNORE_CASE).containsMatchIn(value)) return false
  if (Regex("\\b0\\s+credentials?\\b", RegexOption.IGNORE_CASE).containsMatchIn(value)) return false
  return true
}

internal fun validProfile(value: String) =
  value.length in 3..320 && value.matches(Regex("[A-Za-z_][A-Za-z0-9._-]{0,63}@[A-Za-z0-9:.\\[\\]-]+:[1-9][0-9]{0,4}"))

private const val MAX_SECRET_LENGTH = 16 * 1024
private const val MAX_PRIVATE_KEY_BYTES = 128 * 1024
private const val MAX_PROMPT_BYTES = 128 * 1024
