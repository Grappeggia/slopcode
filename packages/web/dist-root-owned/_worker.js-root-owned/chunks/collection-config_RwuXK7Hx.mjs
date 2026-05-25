globalThis.process ??= {}
globalThis.process.env ??= {}
let userCollections
try {
  userCollections = (await import("./content.config_CXf6mej7.mjs")).collections
} catch {}
const collections = userCollections

export { collections }
