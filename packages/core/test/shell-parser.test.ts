import { describe, expect, test } from "bun:test"
import { ShellParser } from "@slopcode-ai/core/shell-parser"
import { Wildcard } from "@slopcode-ai/core/util/wildcard"

const bash = (command: string) => ShellParser.resources(command, "/bin/bash")
const sh = (command: string, shell = "/bin/sh") => ShellParser.resources(command, shell)
const powershell = (command: string) => ShellParser.resources(command, "C:\\Program Files\\PowerShell\\7\\pwsh.exe")
const cmd = (command: string) => ShellParser.resources(command, "C:\\Windows\\System32\\cmd.exe")

describe("ShellParser Bash resources", () => {
  test("preserves a normal single command", async () => {
    expect(await bash("git status")).toEqual(["git status"])
  })

  test.each([
    ["semicolon", "git status; rm -rf target"],
    ["newline", "git status\nrm -rf target"],
    ["and", "git status && rm -rf target"],
    ["or", "git status || rm -rf target"],
    ["pipeline", "git status | rm -rf target"],
    ["background", "git status & rm -rf target"],
    ["subshell", "(git status; rm -rf target)"],
    ["group", "{ git status; rm -rf target; }"],
  ])("extracts each command joined by %s", async (_label, command) => {
    expect(await bash(command)).toEqual(["git status", "rm -rf target"])
  })

  test("keeps command redirects and redirect-only statements visible", async () => {
    expect(await bash("printf hi > target")).toEqual(["printf hi > target"])
    expect(await bash("> target")).toEqual(["> target"])
    expect(await bash("{ printf hi; } > target")).toEqual(["{ printf hi; } > target", "printf hi"])
    expect(await bash("f() { printf hi; } > target; f")).toEqual(["f() { printf hi; } > target", "printf hi", "f"])
  })

  test("extracts command and process substitutions", async () => {
    expect(await bash('echo "$(rm -rf target)"')).toEqual(['echo "$(rm -rf target)"', "rm -rf target"])
    expect(await bash("echo `rm -rf target`")).toEqual(["echo `rm -rf target`", "rm -rf target"])
    expect(await bash("cat <(read-one) > >(write-one)")).toEqual([
      "cat <(read-one) > >(write-one)",
      "read-one",
      "write-one",
    ])
  })

  test("extracts substitutions from a heredoc", async () => {
    const command = "cat <<EOF\nhello $(rm -rf target)\nEOF"
    expect(await bash(command)).toEqual([command, "rm -rf target"])
  })

  test("does not split quoted or escaped operators", async () => {
    expect(await bash(`printf '%s\\n' 'a; b && c || d | e & f'`)).toEqual([`printf '%s\\n' 'a; b && c || d | e & f'`])
    expect(await bash("echo a\\;b \\& c")).toEqual(["echo a\\;b \\& c"])
  })

  test("keeps non-command shell statements from hiding a later command", async () => {
    expect(await bash("PATH=/tmp; git status")).toEqual(["PATH=/tmp", "git status"])
    expect(await bash("export PATH=/tmp; git status")).toEqual(["export PATH=/tmp", "git status"])
    expect(await bash("[[ -f target ]] || rm -rf target")).toEqual(["[[ -f target ]]", "rm -rf target"])
  })

  test("fails closed on malformed or unsupported shell syntax", async () => {
    await expect(bash('git status; "')).rejects.toBeInstanceOf(ShellParser.SyntaxError)
    await expect(ShellParser.resources("git status", "/usr/bin/fish")).rejects.toBeInstanceOf(
      ShellParser.UnsupportedError,
    )
  })

  test("uses an opaque resource when Bash has no executable atoms", async () => {
    expect(await bash("")).toEqual([ShellParser.opaque("/bin/bash", "")])
    expect(await bash("   ")).toEqual([ShellParser.opaque("/bin/bash", "   ")])
    expect(await bash("# comment")).toEqual([ShellParser.opaque("/bin/bash", "# comment")])
  })
})

describe("ShellParser conservative POSIX resources", () => {
  test("only identifies an actual bash executable as Bash", () => {
    expect(ShellParser.kind("/bin/bash")).toBe("bash")
    for (const shell of ["/bin/sh", "/usr/bin/dash", "/bin/ash", "/bin/ksh", "/bin/zsh"]) {
      expect(ShellParser.kind(shell)).toBe("posix")
    }
  })

  test("keeps demonstrably safe single commands prefix-matchable", async () => {
    expect(await sh("git status")).toEqual(["git status"])
    expect(await sh(`git "a; b & c"`)).toEqual([`git "a; b & c"`])
    expect(await sh("git status \\; literal")).toEqual(["git status \\; literal"])
    expect(await sh("git '$HOME $(rm target) `rm target`'")).toEqual(["git '$HOME $(rm target) `rm target`'"])
  })

  test.each([
    "git status &> /dev/null rm -rf target",
    "git status; rm -rf target",
    "git status\nrm -rf target",
    "git status && rm -rf target",
    "git status || rm -rf target",
    "git status | rm -rf target",
    "git status & rm -rf target",
    "git status > target",
    "(git status)",
    "{ git status; }",
    "git $HOME",
    "git $(rm -rf target)",
    "git `rm -rf target`",
  ])("makes unsafe or dynamic syntax opaque: %s", async (command) => {
    const resource = ShellParser.opaque("/bin/sh", command)
    expect(await sh(command)).toEqual([resource])
    expect(Wildcard.match(resource, "git *")).toBeFalse()
    expect(Wildcard.match(resource, "*")).toBeTrue()
  })

  test("makes empty and comment-only statements opaque", async () => {
    expect(await sh("")).toEqual([ShellParser.opaque("/bin/sh", "")])
    expect(await sh("# comment")).toEqual([ShellParser.opaque("/bin/sh", "# comment")])
  })
})

describe("ShellParser PowerShell resources", () => {
  test("extracts commands, nested commands, and script-block groups", async () => {
    expect(await powershell("git status; Remove-Item target")).toEqual(["git status", "Remove-Item target"])
    expect(await powershell("Write-Output $(Remove-Item target)")).toEqual([
      "Write-Output $(Remove-Item target)",
      "Remove-Item target",
    ])
    expect(await powershell("& { Write-Host one; Remove-Item two }")).toEqual(["Write-Host one", "Remove-Item two"])
  })

  test.each(["& { git status } > target", "& { git status } >> target", "& { git status } < target"])(
    "keeps redirected script-block wrapper effects: %s",
    async (command) => {
      expect(await powershell(command)).toEqual([command, "git status"])
    },
  )

  test("does not add an outer resource for a safe script-block wrapper", async () => {
    expect(await powershell("& { git status }")).toEqual(["git status"])
  })

  test("keeps executable expressions and their redirects opaque", async () => {
    expect(await powershell('"hi" > target')).toEqual(['"hi" > target'])
    expect(await powershell('[IO.File]::Delete("target")')).toEqual(['[IO.File]::Delete("target")'])
    expect(await powershell('git status; if ([IO.File]::Delete("target")) { Write-Host done }')).toEqual([
      "git status",
      '[IO.File]::Delete("target")',
      "Write-Host done",
    ])
    expect(await powershell("git status; if ($?) { Write-Host done }")).toEqual(["git status", "$?", "Write-Host done"])
    expect(await powershell('param($x = [IO.File]::Delete("target")); git status')).toEqual([
      '[IO.File]::Delete("target")',
      "git status",
    ])
    expect(await powershell('class X { static [string] $x = [IO.File]::ReadAllText("target") }; git status')).toEqual([
      '[IO.File]::ReadAllText("target")',
      "git status",
    ])
    expect(await powershell('"payload" > target | git status')).toEqual(['"payload" > target', "git status"])
    expect(await powershell('"payload" | git status')).toEqual(['"payload"', "git status"])
  })

  test("fails closed on malformed syntax", async () => {
    await expect(powershell('git status; "')).rejects.toBeInstanceOf(ShellParser.SyntaxError)
  })

  test("uses an opaque resource when no executable atom is extracted", async () => {
    const shell = "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
    expect(await powershell("exit")).toEqual([ShellParser.opaque(shell, "exit")])
    expect(await powershell("return")).toEqual([ShellParser.opaque(shell, "return")])
    expect(await powershell(";")).toEqual([ShellParser.opaque(shell, ";")])
  })
})

describe("ShellParser cmd resources", () => {
  test("allows conservative single commands and redirects", async () => {
    expect(await cmd("git status")).toEqual(["git status"])
    expect(await cmd('echo "a & b"')).toEqual(['echo "a & b"'])
    expect(await cmd("echo a ^& b")).toEqual(["echo a ^& b"])
    expect(await cmd("> target")).toEqual(["> target"])
    expect(await cmd('echo "a^&b"')).toEqual(['echo "a^&b"'])
    expect(await cmd("echo ^& b")).toEqual(["echo ^& b"])
  })

  test("rejects an unterminated quoted command", async () => {
    await expect(cmd('git status "')).rejects.toBeInstanceOf(ShellParser.SyntaxError)
  })

  test.each([
    "git status & rm target",
    "git status && rm target",
    "git status || rm target",
    "git status | rm target",
    "git status\nrm target",
    "(git status)",
    "git %ARGS%",
    'git status "foo^" & type nul > marker',
    'git status "foo^^" & type nul > marker',
    "git status ^^& type nul > marker",
    'git status ^"foo&bar^"',
  ])("makes compound, dynamic, or uncertain cmd syntax opaque: %s", async (command) => {
    const shell = "C:\\Windows\\System32\\cmd.exe"
    const resource = ShellParser.opaque(shell, command)
    expect(await cmd(command)).toEqual([resource])
    expect(Wildcard.match(resource, "git *")).toBeFalse()
    expect(Wildcard.match(resource, "*")).toBeTrue()
  })
})

describe("ShellParser opaque resources", () => {
  test("encode exact bytes into stable wildcard-safe resources", () => {
    const resource = ShellParser.opaque("/bin/sh", "git * ? / \\ \n")
    expect(resource).toBe("[opaque shell statement] shell-utf8=2f62696e2f7368 source-utf8=676974202a203f202f205c200a")
    expect(Wildcard.match(resource, "*")).toBeTrue()
    expect(Wildcard.match(resource, "git *")).toBeFalse()
    expect(Wildcard.match(ShellParser.opaque("/bin/sh", "git value"), resource)).toBeFalse()
    expect(
      Wildcard.match(ShellParser.opaque("/bin/sh", "read \\tmp"), ShellParser.opaque("/bin/sh", "read /tmp")),
    ).toBeFalse()
  })

  test("remain distinct after Windows-style case folding", () => {
    const upper = ShellParser.opaque("cmd.exe", "curl https://example.test/Auth/Path?token=TokenABC")
    const lower = ShellParser.opaque("cmd.exe", "curl https://example.test/auth/path?token=tokenabc")
    const shell = ShellParser.opaque("CMD.EXE", "curl https://example.test/Auth/Path?token=TokenABC")
    expect(upper).toMatch(/^\[opaque shell statement\] shell-utf8=[0-9a-f]+ source-utf8=[0-9a-f]+$/)
    expect(upper.toLowerCase()).not.toBe(lower.toLowerCase())
    expect(upper.toLowerCase()).not.toBe(shell.toLowerCase())
    expect(Wildcard.match(lower, upper)).toBeFalse()
    expect(Wildcard.match(upper, "*")).toBeTrue()
    expect(Wildcard.match(upper, "git *")).toBeFalse()
  })
})
