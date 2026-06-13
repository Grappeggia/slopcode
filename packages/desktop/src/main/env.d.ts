interface ImportMetaEnv {
  readonly SLOPCODE_CHANNEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:slopcode-server" {
  export namespace Server {
    export const listen: typeof import("../../../slopcode/dist/types/src/node").Server.listen
    export type Listener = import("../../../slopcode/dist/types/src/node").Server.Listener
  }
  export namespace Config {
    export const get: typeof import("../../../slopcode/dist/types/src/node").Config.get
    export type Info = import("../../../slopcode/dist/types/src/node").Config.Info
  }
  export const bootstrap: typeof import("../../../slopcode/dist/types/src/node").bootstrap
}
