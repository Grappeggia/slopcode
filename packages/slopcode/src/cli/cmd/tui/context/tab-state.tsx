import { createEffect, createMemo, on } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { createSimpleContext } from "./helper"
import { useRoute } from "./route"
import { useSessionTabs } from "./session-tabs"
import { DRAFT_TAB_ID } from "./session-tabs-state"
import { useSync } from "./sync"
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
  type EditorTab,
  type TabModel,
  type TabSelection,
} from "./tab-state-store"

export const { use: useTabState, provider: TabStateProvider } = createSimpleContext({
  name: "TabState",
  init: () => {
    const route = useRoute()
    const tabs = useSessionTabs()
    const sync = useSync()
    const [store, setStore] = createStore<Record<string, ReturnType<typeof blankTabState>>>({
      [DRAFT_TAB_ID]: blankTabState(),
    })

    const currentID = createMemo(() => {
      if (route.data.type === "session") return route.data.sessionID
      return DRAFT_TAB_ID
    })

    createEffect(() => {
      const keep = new Set(tabs.ids().filter((id) => id !== DRAFT_TAB_ID))
      if (route.data.type === "session") {
        keep.add(route.data.sessionID)
      }
      setStore(
        produce((draft) => {
          for (const key of Object.keys(draft)) {
            if (key === DRAFT_TAB_ID) continue
            if (keep.has(key)) continue
            removeTabState(draft, key)
          }
        }),
      )
    })

    createEffect(
      on(
        () => tabs.hasDraft(),
        (next, prev) => {
          if (!prev || next) return
          setStore(
            produce((draft) => {
              clearTabPrompt(draft, DRAFT_TAB_ID)
            }),
          )
        },
      ),
    )

    return {
      currentID,
      current() {
        return getTabState(store, currentID())
      },
      get(id: string) {
        return getTabState(store, id)
      },
      all() {
        return store
      },
      setPrompt(id: string, prompt: Parameters<typeof setTabPrompt>[2]) {
        setStore(
          produce((draft) => {
            setTabPrompt(draft, id, prompt)
          }),
        )
      },
      clearPrompt(id: string) {
        setStore(
          produce((draft) => {
            clearTabPrompt(draft, id)
          }),
        )
      },
      setAgent(id: string, agent: string | undefined) {
        setStore(
          produce((draft) => {
            setTabAgent(draft, id, agent)
          }),
        )
      },
      setModel(id: string, agent: string, model: TabModel) {
        setStore(
          produce((draft) => {
            setTabModel(draft, id, agent, model)
          }),
        )
      },
      setVariant(id: string, key: string, variant: string | undefined) {
        setStore(
          produce((draft) => {
            setTabVariant(draft, id, key, variant)
          }),
        )
      },
      copySelection(sourceID: string, targetID: string) {
        setStore(
          produce((draft) => {
            copyTabSelection(draft, sourceID, targetID)
          }),
        )
      },
      copyState(sourceID: string, targetID: string, input?: { prompt?: "copy" | "reset" }) {
        setStore(
          produce((draft) => {
            copyTabState(draft, sourceID, targetID, input)
          }),
        )
      },
      selection(id?: string): TabSelection {
        return getTabState(store, id ?? currentID()).selection
      },
      editor(id?: string) {
        return getTabState(store, id ?? currentID()).editor
      },
      setEditor(id: string, tab: EditorTab) {
        setStore(
          produce((draft) => {
            setEditorTab(draft, id, tab)
          }),
        )
      },
      patchEditor(id: string, file: string, patch: Partial<EditorTab>) {
        setStore(
          produce((draft) => {
            patchEditorTab(draft, id, file, patch)
          }),
        )
      },
      activateEditor(id: string, file: string | undefined) {
        setStore(
          produce((draft) => {
            activateEditorTab(draft, id, file)
          }),
        )
      },
      closeEditor(id: string, file: string) {
        setStore(
          produce((draft) => {
            closeEditorTab(draft, id, file)
          }),
        )
      },
    }
  },
})
