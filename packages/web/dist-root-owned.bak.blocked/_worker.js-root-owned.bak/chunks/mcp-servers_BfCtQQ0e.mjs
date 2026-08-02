globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./mcp-servers_Dd89u9Y-.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
