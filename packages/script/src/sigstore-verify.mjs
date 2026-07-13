import { verify } from "sigstore"

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const input = JSON.parse(Buffer.concat(chunks).toString())
await verify(input.bundle, input.options)
process.stdout.write(JSON.stringify(input.bundle))
