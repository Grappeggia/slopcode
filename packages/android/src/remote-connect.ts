// Keep the non-UI import path stable for Android callers and tests. The
// component remains in the TSX module so the existing app entrypoint does not
// need to know about the implementation split.
// @ts-ignore -- the Android bundler resolves the adjacent TSX module.
export * from "./remote-connect.tsx"
