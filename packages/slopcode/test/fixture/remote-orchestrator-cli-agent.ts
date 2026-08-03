const agent = process.argv[2] ?? "cli"
let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (value) => {
  input += value
})
process.stdin.on("end", () => {
  process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "fixture-thread" })}\n`)
  process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`)
  process.stdout.write(
    `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: `${agent}:${input.trim()}` }] } })}\n`,
  )
  process.stdout.write(`${JSON.stringify({ type: "turn.completed" })}\n`)
})
