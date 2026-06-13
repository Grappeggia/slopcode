// @ts-nocheck

import { SlopCode } from "@slopcode-ai/core"
import { ReadTool } from "@slopcode-ai/core/tools"

const slopcode = SlopCode.make({})

slopcode.tool.add(ReadTool)

slopcode.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

slopcode.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

slopcode.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await slopcode.session.create({
  agent: "build",
})

slopcode.subscribe((event) => {
  console.log(event)
})

await slopcode.session.prompt({
  sessionID,
  text: "hey what is up",
})

await slopcode.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await slopcode.session.wait()

console.log(await slopcode.session.messages(sessionID))
