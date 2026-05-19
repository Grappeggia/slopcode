async function getMod() {
  return import("./skills_BA3jD_Fe.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
