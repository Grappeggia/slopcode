import { describe, expect, test } from "bun:test"
import { segmentRichText, segmentsToMarkdown, updateRichTextStream } from "../../src/cli/render/segment"

const sample = `$ curl -sSf "http://127.0.0.1:8000/health"
# Tests file upload endpoint with settings
$ python3 - <<'PY'
import json, time, urllib.request
print("hello")
PY
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>`

describe("rich render segmentation", () => {
  test("detects heredoc code inside shell transcripts", () => {
    const segments = segmentRichText(sample)
    expect(segments).toEqual([
      {
        kind: "code",
        filetype: "bash",
        text: `$ curl -sSf "http://127.0.0.1:8000/health"
# Tests file upload endpoint with settings
$ python3 - <<'PY'`,
      },
      {
        kind: "code",
        filetype: "python",
        text: 'import json, time, urllib.request\nprint("hello")',
      },
      {
        kind: "code",
        filetype: "bash",
        text: "PY",
      },
      {
        kind: "plain",
        text: `Traceback (most recent call last):
  File "<stdin>", line 1, in <module>`,
      },
    ])
  })

  test("preserves fenced code languages in markdown export", () => {
    const markdown = segmentsToMarkdown(segmentRichText(sample))
    expect(markdown).toContain("```bash")
    expect(markdown).toContain("```python")
    expect(markdown).toContain("```text")
  })

  test("seals completed prose blocks while leaving the live paragraph streaming", () => {
    const state = updateRichTextStream(undefined, "# Title\n\nLive tail")

    expect(state.boundary).toBe("# Title\n\n".length)
    expect(state.sealed).toEqual([
      {
        id: "seg_0",
        kind: "markdown",
        streaming: false,
        text: "# Title\n\n",
      },
    ])
    expect(state.tail).toEqual([
      {
        id: "tail_0",
        kind: "markdown",
        streaming: true,
        text: "Live tail",
      },
    ])
  })

  test("preserves sealed segment identity across append-only updates", () => {
    const first = updateRichTextStream(undefined, "# Title\n\nLive")
    const second = updateRichTextStream(first, "# Title\n\nLive tail")

    expect(second.boundary).toBe(first.boundary)
    expect(second.sealed[0]).toBe(first.sealed[0])
    expect(second.tail).toEqual([
      {
        id: "tail_0",
        kind: "markdown",
        streaming: true,
        text: "Live tail",
      },
    ])
  })

  test("appends newly sealed blocks without rebuilding the earlier prefix", () => {
    const first = updateRichTextStream(undefined, "# Title\n\nLive tail")
    const second = updateRichTextStream(first, "# Title\n\nLive tail\n\n```ts\nconst x")

    expect(second.sealed[0]).toBe(first.sealed[0])
    expect(second.sealed.slice(1)).toEqual([
      {
        id: "seg_1",
        kind: "markdown",
        streaming: false,
        text: "Live tail\n\n",
      },
    ])
    expect(second.tail).toEqual([
      {
        id: "tail_0",
        kind: "markdown",
        streaming: true,
        text: "```ts\nconst x",
      },
    ])
  })

  test("seals an open code tail once the stream completes", () => {
    const first = updateRichTextStream(undefined, "# Title\n\n```ts\nconst x")
    const second = updateRichTextStream(first, "# Title\n\n```ts\nconst x\n```", true)

    expect(second.boundary).toBe("# Title\n\n```ts\nconst x\n```".length)
    expect(second.sealed[0]).toBe(first.sealed[0])
    expect(second.sealed.slice(1)).toEqual([
      {
        id: "seg_1",
        kind: "code",
        filetype: "typescript",
        streaming: false,
        text: "const x",
      },
    ])
    expect(second.tail).toEqual([])
  })

  test("keeps an open heredoc transcript mutable until the marker arrives", () => {
    const first = updateRichTextStream(undefined, "$ python3 - <<'PY'\nprint(1)")
    const second = updateRichTextStream(first, "$ python3 - <<'PY'\nprint(1)\nPY", true)

    expect(first.boundary).toBe(0)
    expect(first.sealed).toEqual([])
    expect(first.tail.map((segment) => segment.kind)).toEqual(["code", "code"])
    expect(second.tail).toEqual([])
    expect(second.sealed).toEqual([
      {
        id: "seg_0",
        kind: "code",
        filetype: "bash",
        streaming: false,
        text: "$ python3 - <<'PY'",
      },
      {
        id: "seg_1",
        kind: "code",
        filetype: "python",
        streaming: false,
        text: "print(1)",
      },
      {
        id: "seg_2",
        kind: "code",
        filetype: "bash",
        streaming: false,
        text: "PY",
      },
    ])
  })
})
