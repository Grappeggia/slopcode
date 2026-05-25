import { createSimpleContext } from "../../context/helper"
import {
  createPromptHistorySession,
  promptHistoryKey,
  promptHistoryPath,
  readPromptHistory,
  writePromptHistory,
  type PromptHistoryScope,
  type PromptInfo,
} from "./history-store"

export {
  createPromptHistorySessionForTest,
  promptHistoryPath,
  readPromptHistory,
  writePromptHistory,
  type PromptHistoryScope,
  type PromptInfo,
} from "./history-store"

export const { use: usePromptHistory, provider: PromptHistoryProvider } = createSimpleContext({
  name: "PromptHistory",
  init: () => {
    const cache = new Map<string, ReturnType<typeof createPromptHistorySession>>()

    const load = (input?: PromptHistoryScope) => {
      const name = promptHistoryKey(input)
      const cached = cache.get(name)
      if (cached) return cached

      const filePath = promptHistoryPath(input)
      const loaded = readPromptHistory(filePath)
      const session = createPromptHistorySession(filePath, loaded.history)
      cache.set(name, session)
      if (loaded.dirty) {
        void writePromptHistory(filePath, loaded.history).catch(() => {})
      }
      return session
    }

    return {
      has(input?: PromptHistoryScope) {
        return load(input).has()
      },
      move(input: PromptHistoryScope | undefined, direction: 1 | -1, item: PromptInfo) {
        return load(input).move(direction, item)
      },
      append(input: PromptHistoryScope | undefined, item: PromptInfo) {
        load(input).append(item)
      },
    }
  },
})
