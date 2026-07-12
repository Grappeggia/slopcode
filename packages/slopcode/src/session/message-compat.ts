import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { MessageID, PartID, SessionID } from "./schema"
import { DateTime } from "effect"

export function projectV2(
  sessionID: SessionID,
  messages: readonly SessionMessage.Message[],
  info: SessionV2.Info,
): SessionV1.WithParts[] {
  let parent = MessageID.make("msg_v2_root")
  return messages.flatMap((message): SessionV1.WithParts[] => {
    if (message.type === "user") {
      parent = MessageID.make(message.id)
      const parts: SessionV1.Part[] = [
        ...(message.text
          ? [
              {
                id: PartID.make(`prt_v2_${message.id}_text`),
                sessionID,
                messageID: parent,
                type: "text" as const,
                text: message.text,
              },
            ]
          : []),
        ...(message.files ?? []).map((file, index) => ({
          id: PartID.make(`prt_v2_${message.id}_file_${index}`),
          sessionID,
          messageID: parent,
          type: "file" as const,
          mime: file.mime,
          filename: file.name,
          url: file.uri,
        })),
        ...(message.agents ?? []).map((agent, index) => ({
          id: PartID.make(`prt_v2_${message.id}_agent_${index}`),
          sessionID,
          messageID: parent,
          type: "agent" as const,
          name: agent.name,
          source: agent.source
            ? { value: agent.source.text, start: agent.source.start, end: agent.source.end }
            : undefined,
        })),
      ]
      return [
        {
          info: {
            id: parent,
            sessionID,
            role: "user",
            time: { created: DateTime.toEpochMillis(message.time.created) },
            agent: info.agent ?? "build",
            model: {
              providerID: info.model?.providerID ?? ProviderV2.ID.make("unknown"),
              modelID: info.model?.id ?? ModelV2.ID.make("unknown"),
              variant: info.model?.variant,
            },
            format:
              message.format?.type === "json_schema"
                ? {
                    type: "json_schema",
                    schema: message.format.schema,
                    retryCount: message.format.retry_count,
                  }
                : message.format,
          },
          parts,
        },
      ]
    }
    if (message.type !== "assistant") return []
    const id = MessageID.make(message.id)
    const error = message.structuredError
      ? new SessionV1.StructuredOutputError({
          message: message.structuredError.message,
          retries: Math.max(0, message.structuredError.attempts - 1),
        })
      : undefined
    return [
      {
        info: {
          id,
          sessionID,
          role: "assistant",
          parentID: parent,
          modelID: message.model.id,
          providerID: message.model.providerID,
          mode: message.agent,
          agent: message.agent,
          path: { cwd: info.location.directory, root: info.location.directory },
          cost: message.cost ?? 0,
          tokens: message.tokens ?? { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: {
            created: DateTime.toEpochMillis(message.time.created),
            completed: message.time.completed ? DateTime.toEpochMillis(message.time.completed) : undefined,
          },
          finish: message.finish,
          structured: message.structured,
          error: error?.toObject(),
        },
        parts: message.content.flatMap((part) =>
          part.type === "text"
            ? [
                {
                  id: PartID.make(`prt_v2_${part.id}`),
                  sessionID,
                  messageID: id,
                  type: "text" as const,
                  text: part.text,
                },
              ]
            : [],
        ),
      },
    ]
  })
}
