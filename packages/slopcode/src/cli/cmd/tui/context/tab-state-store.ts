import { unwrap } from "solid-js/store"
import type { PromptInfo } from "../component/prompt/history"

export type TabModel = {
  providerID: string
  modelID: string
}

export type TabSelection = {
  agent?: string
  model: Record<string, TabModel>
  variant: Record<string, string | undefined>
}

export type EditorTab = {
  file: string
  editorID: string
  dirty: boolean
  diff: boolean
  mode: string
  status: string
}

export type EditorTabs = {
  tabs: EditorTab[]
  active?: string
}

export type TabState = {
  prompt: PromptInfo
  selection: TabSelection
  editor: EditorTabs
}

export type TabStateStore = Record<string, TabState>

export function blankPrompt(): PromptInfo {
  return {
    input: "",
    parts: [],
    mode: "normal",
  }
}

export function blankSelection(): TabSelection {
  return {
    model: {},
    variant: {},
  }
}

export function blankEditorTabs(): EditorTabs {
  return {
    tabs: [],
  }
}

export function blankTabState(): TabState {
  return {
    prompt: blankPrompt(),
    selection: blankSelection(),
    editor: blankEditorTabs(),
  }
}

export function clonePrompt(prompt?: PromptInfo): PromptInfo {
  return structuredClone(unwrap(prompt ?? blankPrompt()))
}

export function cloneSelection(selection?: Partial<TabSelection>): TabSelection {
  return {
    agent: selection?.agent,
    model: structuredClone(unwrap(selection?.model ?? {})),
    variant: structuredClone(unwrap(selection?.variant ?? {})),
  }
}

export function cloneEditor(editor?: Partial<EditorTabs>): EditorTabs {
  return {
    active: editor?.active,
    tabs: structuredClone(unwrap(editor?.tabs ?? [])),
  }
}

export function cloneTabState(state?: Partial<TabState>): TabState {
  return {
    prompt: clonePrompt(state?.prompt),
    selection: cloneSelection(state?.selection),
    editor: cloneEditor(state?.editor),
  }
}

export function getTabState(store: TabStateStore, id: string) {
  return store[id] ?? blankTabState()
}

export function ensureTabState(store: TabStateStore, id: string) {
  store[id] ??= blankTabState()
  return store[id]
}

export function setTabPrompt(store: TabStateStore, id: string, prompt: PromptInfo) {
  const next = clonePrompt(prompt)
  const current = getTabState(store, id).prompt
  if (current.input === next.input && current.mode === next.mode && Bun.deepEquals(current.parts, next.parts)) return
  ensureTabState(store, id).prompt = next
}

export function clearTabPrompt(store: TabStateStore, id: string) {
  setTabPrompt(store, id, blankPrompt())
}

export function setTabAgent(store: TabStateStore, id: string, agent: string | undefined) {
  const selection = ensureTabState(store, id).selection
  if (selection.agent === agent) return
  selection.agent = agent
}

export function setTabModel(store: TabStateStore, id: string, agent: string, model: TabModel) {
  const selection = ensureTabState(store, id).selection
  const current = selection.model[agent]
  if (current?.providerID === model.providerID && current.modelID === model.modelID) return
  selection.model[agent] = structuredClone(model)
}

export function setTabVariant(store: TabStateStore, id: string, key: string, variant: string | undefined) {
  const selection = ensureTabState(store, id).selection
  if (selection.variant[key] === variant) return
  selection.variant[key] = variant
}

export function copyTabSelection(store: TabStateStore, sourceID: string, targetID: string) {
  ensureTabState(store, targetID).selection = cloneSelection(getTabState(store, sourceID).selection)
}

export function copyTabState(
  store: TabStateStore,
  sourceID: string,
  targetID: string,
  input?: { prompt?: "copy" | "reset" },
) {
  const source = getTabState(store, sourceID)
  ensureTabState(store, targetID).selection = cloneSelection(source.selection)
  ensureTabState(store, targetID).prompt = input?.prompt === "reset" ? blankPrompt() : clonePrompt(source.prompt)
}

export function setEditorTab(store: TabStateStore, id: string, tab: EditorTab) {
  const editor = ensureTabState(store, id).editor
  const index = editor.tabs.findIndex((item) => item.file === tab.file)
  if (index === -1) {
    editor.tabs = [...editor.tabs, structuredClone(tab)]
    editor.active = tab.file
    return
  }
  editor.tabs[index] = {
    ...editor.tabs[index],
    ...structuredClone(tab),
  }
  editor.active = tab.file
}

export function patchEditorTab(store: TabStateStore, id: string, file: string, patch: Partial<EditorTab>) {
  const editor = ensureTabState(store, id).editor
  const index = editor.tabs.findIndex((item) => item.file === file)
  if (index === -1) return
  editor.tabs[index] = {
    ...editor.tabs[index],
    ...structuredClone(patch),
  }
}

export function activateEditorTab(store: TabStateStore, id: string, file: string | undefined) {
  const editor = ensureTabState(store, id).editor
  if (!file) {
    editor.active = undefined
    return
  }
  if (!editor.tabs.some((item) => item.file === file)) return
  editor.active = file
}

export function closeEditorTab(store: TabStateStore, id: string, file: string) {
  const editor = ensureTabState(store, id).editor
  const index = editor.tabs.findIndex((item) => item.file === file)
  if (index === -1) return
  editor.tabs = editor.tabs.filter((item) => item.file !== file)
  if (editor.active !== file) return
  editor.active = editor.tabs[index]?.file ?? editor.tabs[index - 1]?.file
}

export function removeTabState(store: TabStateStore, id: string) {
  delete store[id]
}
