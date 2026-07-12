import * as Schema from "effect/Schema"
import { SessionFormat } from "./format"

export class Source extends Schema.Class<Source>("Prompt.Source")({
  start: Schema.Finite,
  end: Schema.Finite,
  text: Schema.String,
}) {}

export class FileAttachment extends Schema.Class<FileAttachment>("Prompt.FileAttachment")({
  uri: Schema.String,
  mime: Schema.String,
  name: Schema.String.pipe(Schema.optional),
  description: Schema.String.pipe(Schema.optional),
  source: Source.pipe(Schema.optional),
}) {
  static create(input: FileAttachment) {
    return new FileAttachment({
      uri: input.uri,
      mime: input.mime,
      name: input.name,
      description: input.description,
      source: input.source,
    })
  }
}

export class AgentAttachment extends Schema.Class<AgentAttachment>("Prompt.AgentAttachment")({
  name: Schema.String,
  source: Source.pipe(Schema.optional),
}) {}

export class Prompt extends Schema.Class<Prompt>("Prompt")({
  text: Schema.String,
  files: Schema.Array(FileAttachment).pipe(Schema.optional),
  agents: Schema.Array(AgentAttachment).pipe(Schema.optional),
  format: SessionFormat.Format.pipe(Schema.optional),
}) {
  static readonly equivalence = (left: Prompt, right: Prompt) =>
    left.text === right.text &&
    Schema.toEquivalence(Schema.Array(FileAttachment))(left.files ?? [], right.files ?? []) &&
    Schema.toEquivalence(Schema.Array(AgentAttachment))(left.agents ?? [], right.agents ?? []) &&
    SessionFormat.equivalent(left.format, right.format)

  static fromUserMessage(input: Pick<Prompt, "text" | "files" | "agents" | "format">) {
    return new Prompt({
      text: input.text,
      ...(input.files === undefined ? {} : { files: input.files }),
      ...(input.agents === undefined ? {} : { agents: input.agents }),
      ...(input.format === undefined ? {} : { format: input.format }),
    })
  }
}
