declare global {
  const SLOPCODE_VERSION: string
  const SLOPCODE_CHANNEL: string
}

export const InstallationVersion = typeof SLOPCODE_VERSION === "string" ? SLOPCODE_VERSION : "local"
export const InstallationChannel = typeof SLOPCODE_CHANNEL === "string" ? SLOPCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
