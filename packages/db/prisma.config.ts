import { defineConfig } from 'prisma/config'

// `generate` and `migrate diff` don't connect, so a placeholder URL is fine; `migrate deploy` gets the real
// DATABASE_URL from the environment.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/unset' },
})
