type AndroidBridgePort = {
  postMessage(message: string): void
  onmessage: ((event: { data?: string }) => void) | null
}

declare global {
  interface Window {
    SlopcodeAndroid?: AndroidBridgePort
    __SLOPCODE__?: {
      deepLinks?: string[]
    }
  }
}

export {}
