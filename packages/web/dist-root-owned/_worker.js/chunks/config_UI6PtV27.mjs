globalThis.process ??= {}
globalThis.process.env ??= {}
const stage = process.env.SST_STAGE || "dev"
const config = {
  console: stage === "production" ? "https://slopcode.dev/auth" : `https://${stage}.slopcode.ai/auth`,
  email: "contact@slopcode.dev",
  socialCard: "https://social-cards.sst.dev",
  github: "http://github.com/teamslop/slopcode",
}

export { config as c }
