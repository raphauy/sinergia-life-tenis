import { config } from "dotenv"
config({ path: ".env.local" })
config() // fallback to .env

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  },
})
