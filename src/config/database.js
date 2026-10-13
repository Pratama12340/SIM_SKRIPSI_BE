import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Konfigurasi koneksi PostgreSQL/Neon via Prisma Client (Prisma 7 + driver adapter pg).
 *
 * - Aplikasi (runtime) memakai DATABASE_URL.
 *   Untuk Neon gunakan koneksi POOLED (hostname berakhiran -pooler).
 * - Prisma CLI (migrate / seed / studio) memakai DIRECT_URL
 *   yang didefinisikan di prisma.config.ts (koneksi direct/unpooled).
 */
const connectionString = process.env.DATABASE_URL || undefined;

if (!connectionString) {
  console.warn('[Database] Variabel DATABASE_URL belum ditemukan di .env — koneksi database akan gagal.');
}

const adapter = new PrismaPg({
  connectionString,
  max: 10, // setara connectionLimit: 10 pada mysql2 sebelumnya
  connectionTimeoutMillis: 15000, // beri waktu Neon "bangun" dari scale-to-zero
});

const prisma = new PrismaClient({ adapter });

function describeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '(DATABASE_URL tidak valid)';
  }
}

/** Verifikasi koneksi ke PostgreSQL/Neon. */
export async function testConnection() {
  if (!connectionString) {
    console.error('[Database Error] DATABASE_URL tidak diatur. Salin .env.example menjadi .env lalu isi kredensial Neon.');
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[Database] Terhubung ke PostgreSQL: ${describeUrl(connectionString)}`);
    return true;
  } catch (error) {
    console.error('[Database Error] Gagal terhubung ke PostgreSQL/Neon:', error.message);
    return false;
  }
}

/** Tutup koneksi dengan rapi (dipakai pada graceful shutdown). */
export async function disconnect() {
  await prisma.$disconnect();
}

export default prisma;
