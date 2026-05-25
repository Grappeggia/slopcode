import z from "zod"

export namespace DaemonAuth {
  export const Header = "x-slopcode-daemon-token"

  export const Info = z.object({
    token: z.string(),
  })

  let token: string | undefined

  export function set(value?: string) {
    token = value
  }

  export function enabled() {
    return !!token
  }

  export function valid(value?: string | null) {
    return !!token && value === token
  }

  export function check(headers: Headers) {
    return valid(headers.get(Header))
  }
}
