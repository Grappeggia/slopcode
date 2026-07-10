import { describe, expect, test } from "bun:test"
import { ShellParser } from "@slopcode-ai/core/shell-parser"

const bash = (command: string) => ShellParser.resources(command, "/bin/bash")
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
  })

  test("fails closed on malformed syntax", async () => {
    await expect(powershell('git status; "')).rejects.toBeInstanceOf(ShellParser.SyntaxError)
  })
})

describe("ShellParser cmd resources", () => {
  test("allows conservative single commands and redirects", async () => {
    expect(await cmd("git status")).toEqual(["git status"])
    expect(await cmd('echo "a & b"')).toEqual(['echo "a & b"'])
    expect(await cmd("echo a ^& b")).toEqual(["echo a ^& b"])
    expect(await cmd("> target")).toEqual(["> target"])
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
  ])("fails closed on compound or dynamic cmd syntax: %s", async (command) => {
    await expect(cmd(command)).rejects.toBeInstanceOf(ShellParser.UnsupportedError)
  })
})
