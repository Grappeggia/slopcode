import { describe, expect, test } from "bun:test"
import { createStore } from "solid-js/store"
import { DRAFT_TAB_ID } from "../../../src/cli/cmd/tui/context/session-tabs-state"
import {
  activateEditorTab,
  blankTabState,
  clearTabPrompt,
  closeEditorTab,
  copyTabSelection,
  copyTabState,
  getTabState,
  patchEditorTab,
  removeTabState,
  setEditorTab,
  setTabAgent,
  setTabModel,
  setTabPrompt,
  setTabVariant,
  type TabStateStore,
} from "../../../src/cli/cmd/tui/context/tab-state-store"

describe("tab state store", () => {
  test("returns a blank state for unknown tabs", () => {
    const store: TabStateStore = {}

    expect(getTabState(store, "ses_1")).toEqual(blankTabState())
  })

  test("stores prompt mode per tab", () => {
    const store: TabStateStore = {}

    setTabPrompt(store, DRAFT_TAB_ID, {
      input: "echo hello",
      parts: [],
      mode: "shell",
    })

    expect(getTabState(store, DRAFT_TAB_ID).prompt).toEqual({
      input: "echo hello",
      parts: [],
      mode: "shell",
    })
  })

  test("copies selection without copying prompt", () => {
    const store: TabStateStore = {}

    setTabPrompt(store, DRAFT_TAB_ID, {
      input: "draft prompt",
      parts: [],
      mode: "normal",
    })
    setTabAgent(store, DRAFT_TAB_ID, "build")
    setTabModel(store, DRAFT_TAB_ID, "build", {
      providerID: "openai",
      modelID: "gpt-5",
    })
    setTabVariant(store, DRAFT_TAB_ID, "openai/gpt-5", "fast")

    copyTabSelection(store, DRAFT_TAB_ID, "ses_1")

    expect(getTabState(store, "ses_1")).toEqual({
      prompt: {
        input: "",
        parts: [],
        mode: "normal",
      },
      selection: {
        agent: "build",
        model: {
          build: {
            providerID: "openai",
            modelID: "gpt-5",
          },
        },
        variant: {
          "openai/gpt-5": "fast",
        },
      },
      editor: {
        tabs: [],
      },
    })
  })

  test("copies full tab state and can reset the prompt", () => {
    const store: TabStateStore = {}

    setTabPrompt(store, DRAFT_TAB_ID, {
      input: "fork me",
      parts: [],
      mode: "normal",
    })
    setTabAgent(store, DRAFT_TAB_ID, "plan")

    copyTabState(store, DRAFT_TAB_ID, "ses_2")
    copyTabState(store, DRAFT_TAB_ID, "ses_3", { prompt: "reset" })

    expect(getTabState(store, "ses_2").prompt.input).toBe("fork me")
    expect(getTabState(store, "ses_2").selection.agent).toBe("plan")
    expect(getTabState(store, "ses_3").prompt).toEqual({
      input: "",
      parts: [],
      mode: "normal",
    })
    expect(getTabState(store, "ses_3").selection.agent).toBe("plan")
  })

  test("clears prompts and removes session state", () => {
    const store: TabStateStore = {}

    setTabPrompt(store, "ses_4", {
      input: "temp",
      parts: [],
      mode: "normal",
    })
    clearTabPrompt(store, "ses_4")
    removeTabState(store, "ses_4")

    expect(store).toEqual({})
  })

  test("tracks persistent editor tabs per session", () => {
    const store: TabStateStore = {}

    setEditorTab(store, "ses_5", {
      file: "src/foo.ts",
      editorID: "editor-1",
      dirty: false,
      diff: false,
      mode: "EDIT",
      status: "running",
    })
    setEditorTab(store, "ses_5", {
      file: "src/bar.ts",
      editorID: "editor-2",
      dirty: true,
      diff: false,
      mode: "EDIT",
      status: "running",
    })
    activateEditorTab(store, "ses_5", "src/foo.ts")
    patchEditorTab(store, "ses_5", "src/foo.ts", { dirty: true })
    closeEditorTab(store, "ses_5", "src/bar.ts")

    expect(getTabState(store, "ses_5").editor).toEqual({
      active: "src/foo.ts",
      tabs: [
        {
          file: "src/foo.ts",
          editorID: "editor-1",
          dirty: true,
          diff: false,
          mode: "EDIT",
          status: "running",
        },
      ],
    })
  })

  test("accepts prompt proxies from solid stores", () => {
    const store: TabStateStore = {}
    const [state] = createStore({
      prompt: {
        input: "hello",
        parts: [],
        mode: "normal" as const,
      },
    })

    expect(() => setTabPrompt(store, DRAFT_TAB_ID, state.prompt)).not.toThrow()
    expect(getTabState(store, DRAFT_TAB_ID).prompt).toEqual(state.prompt)
  })
})
