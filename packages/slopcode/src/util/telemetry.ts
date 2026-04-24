import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { product } from "@slopcode-ai/util/product"
import { Flag } from "../flag/flag"
import { Installation } from "../installation"

let started = false

function headers() {
  const value = process.env.OTEL_EXPORTER_OTLP_HEADERS
  if (!value) return undefined
  return value.split(",").reduce(
    (acc, item) => {
      const index = item.indexOf("=")
      if (index < 1) return acc
      acc[item.slice(0, index)] = item.slice(index + 1)
      return acc
    },
    {} as Record<string, string>,
  )
}

function attributes() {
  const value = process.env.OTEL_RESOURCE_ATTRIBUTES
  const attrs = value
    ? value.split(",").reduce(
        (acc, entry) => {
          const index = entry.indexOf("=")
          if (index < 1) return acc
          acc[decodeURIComponent(entry.slice(0, index))] = decodeURIComponent(entry.slice(index + 1))
          return acc
        },
        {} as Record<string, string>,
      )
    : {}

  return {
    ...attrs,
    "service.name": product.id,
    "service.version": Installation.VERSION,
    "slopcode.client": Flag.SLOPCODE_CLIENT,
  }
}

export namespace Telemetry {
  export async function init() {
    const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    if (!base || started) return
    started = true

    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes(attributes()),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: `${base}/v1/traces`,
            headers: headers(),
          }),
        ),
      ],
    })

    provider.register({
      contextManager: new AsyncLocalStorageContextManager(),
    })
  }
}
