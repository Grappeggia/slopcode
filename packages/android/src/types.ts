export type AndroidCapabilities = {
  secureStorage: boolean
  qrPairing: boolean
  notifications: boolean
  deepLinks: boolean
  remoteTransport: boolean
  backgroundExecution: boolean
  remoteJobs: boolean
}

export type AndroidSecureStorage = {
  getItem(namespace: string, key: string): Promise<string | null>
  setItem(namespace: string, key: string, value: string): Promise<void>
  removeItem(namespace: string, key: string): Promise<void>
  clear(namespace: string): Promise<void>
  keys(namespace: string): Promise<string[]>
  length(namespace: string): Promise<number>
}
