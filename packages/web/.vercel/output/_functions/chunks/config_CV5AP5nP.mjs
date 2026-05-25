const stage = process.env.SST_STAGE || (process.env.VERCEL_ENV === "production" ? "production" : "dev")

const config = {
  console: stage === "production" ? "https://slopcode.dev/auth" : `https://${stage}.slopcode.ai/auth`,
  email: "contact@slopcode.dev",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/teamslop/slopcode",
}

export { config as c }
