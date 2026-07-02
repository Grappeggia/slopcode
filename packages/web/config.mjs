const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://slopcode.ai" : `https://${stage}.slopcode.ai`,
  console: stage === "production" ? "https://slopcode.ai/auth" : `https://${stage}.slopcode.ai/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/teamslop/slopcode",
  discord: "https://slopcode.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/docs/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
