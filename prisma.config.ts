import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // Lokasi schema Prisma
  schema: 'prisma/schema.prisma',

  // Lokasi folder migrasi + perintah seed untuk `prisma db seed`
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },

  // Koneksi yang dipakai Prisma CLI (migrate, studio, db seed).
  // Di Neon gunakan koneksi DIRECT (unpooled); aplikasi memakai DATABASE_URL (pooler).
  datasource: {
    url: env('DIRECT_URL'),
  },
})
