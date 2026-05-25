import { EventEmitter } from "events"

type GlobalEvent = {
  directory?: string
  payload: {
    type: string
    properties: Record<string, unknown>
  }
}

export const GlobalBus = new EventEmitter() as EventEmitter & {
  emit(event: "event", payload: GlobalEvent): boolean
  on(event: "event", listener: (payload: GlobalEvent) => void): EventEmitter
  off(event: "event", listener: (payload: GlobalEvent) => void): EventEmitter
}
