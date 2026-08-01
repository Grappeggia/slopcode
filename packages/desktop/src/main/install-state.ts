export function hasExistingAppState(entries: Array<{ name: string; isDirectory: () => boolean }>) {
  return entries.some((entry) => {
    if (entry.name === "slopcode.settings") return true
    if (entry.name === "default.dat") return true
    if (/^slopcode\..+\.dat$/.test(entry.name)) return true
    if (/^window-state-.+\.json$/.test(entry.name)) return true
    return entry.isDirectory() && entry.name === "slopcode"
  })
}
