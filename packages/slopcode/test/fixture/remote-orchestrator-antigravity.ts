const prompt = process.env.AGY_TEST_PROMPT ?? ""
const args = process.argv.slice(2)
const text = ["--new-project", "--add-dir", process.cwd(), "--sandbox", "--dangerously-skip-permissions", "--prompt", prompt]
const stream = [...text, "--output-format", "stream-json"]

if (JSON.stringify(args) === JSON.stringify(stream)) {
  process.stderr.write("Error: unknown option '--output-format'\n")
  process.exit(2)
}

if (JSON.stringify(args) === JSON.stringify(text)) {
  process.stdout.write("fallback-ok")
  process.exit(0)
}

process.stderr.write(`invalid fake Antigravity argv: ${JSON.stringify(args)}\n`)
process.exit(64)
