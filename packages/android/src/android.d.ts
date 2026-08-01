import type { AndroidNativeBridge } from "./bridge"

declare global {
  interface Window {
    SlopcodeAndroid?: AndroidNativeBridge
    __SLOPCODE__?: {
      deepLinks?: string[]
    }
  }
}

export {}
