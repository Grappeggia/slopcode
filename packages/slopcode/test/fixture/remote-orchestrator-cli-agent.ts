const agent = process.argv[2] ?? "cli"
const prompt = process.argv[3]
let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (value) => {
  input += value
})
process.stdin.on("end", () => {
  process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "fixture-thread" })}\n`)
  process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`)
  process.stdout.write(
    `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: `${agent}:${prompt ?? input.trim()}` }] } })}\n`,
  )
  if (agent === "claude")
    process.stdout.write(`${JSON.stringify({ type: "result", result: `${agent}:${prompt ?? input.trim()}` })}\n`)
  process.stdout.write(`${JSON.stringify({ type: "turn.completed" })}\n`)
})
