globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./mcp-servers_DJ1vL9MP.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
