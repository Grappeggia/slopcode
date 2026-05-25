import type { Config } from "../config"

export type AdaptorInfo = {
  type: string
  name: string
  description: string
}

export type Adaptor<T extends Config = Config> = {
  name: string
  description: string
  create(from: T, branch?: string | null): Promise<{ config: T; init: () => Promise<void> }>
  remove(from: T): Promise<void>
  request(from: T, method: string, url: string, data?: BodyInit, signal?: AbortSignal): Promise<Response | undefined>
}
