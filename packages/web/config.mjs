const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://slopcode.dev" : `https://${stage}.slopcode.dev`,
  console: stage === "production" ? "https://slopcode.dev/auth" : `https://${stage}.slopcode.dev/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/teamslop/slopcode",
  discord: "https://slopcode.dev/discord",
  headerLinks: [
    { name: "app.header.home", url: "/docs/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
