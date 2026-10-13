/**
 * Helper respons & error handling untuk seluruh controller.
 * Menjaga bentuk respons konsisten dengan kontrak API lama:
 *   sukses : { success: true, ... }
 *   gagal  : { success: false, message, error? }
 */

/**
 * Parse parameter :id menjadi integer positif.
 * Mengembalikan null jika bukan bilangan bulat valid
 * (mysql2 dulu mengubah 'abc' menjadi 0 -> tidak cocok; PostgreSQL melempar error 22P02).
 */
export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Mapping error database (Prisma Known Request Error / PostgreSQL SQLSTATE)
 * ke respons HTTP dengan pesan yang aman untuk pengguna.
 *
 * @param {import('express').Response} res
 * @param {any} error
 * @param {string} fallbackMessage - pesan 500 yang dipakai controller
 */
export function sendError(res, error, fallbackMessage) {
  console.error(`[Error] ${fallbackMessage}:`, error);

  const prismaCode = typeof error?.code === 'string' ? error?.code : null;
  // Query mentah: SQLSTATE ada di error.meta.code (P2010) atau langsung di error.code (driver pg)
  const metaState = typeof error?.meta?.code === 'string' ? error.meta.code : null;
  const driverState = typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
  const sqlstate = metaState || driverState;

  // Error Prisma yang dikenal
  if (prismaCode === 'P2002') {
    return res.status(409).json({ success: false, message: 'Data duplikat: sudah ada data serupa di database.' });
  }
  if (prismaCode === 'P2003') {
    return res.status(400).json({ success: false, message: 'Relasi data tidak ditemukan (foreign key tidak cocok).' });
  }
  if (prismaCode === 'P2025') {
    return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
  }

  // SQLSTATE PostgreSQL
  if (sqlstate) {
    if (sqlstate === '23505') {
      return res.status(409).json({ success: false, message: 'Data duplikat: sudah ada data serupa di database.' });
    }
    if (sqlstate === '23503') {
      return res.status(400).json({ success: false, message: 'Relasi data tidak ditemukan (foreign key tidak cocok).' });
    }
    if (sqlstate === '23514') {
      return res.status(400).json({ success: false, message: 'Nilai tidak diizinkan oleh constraint database (cek nilai status).' });
    }
    if (sqlstate === '22001') {
      return res.status(400).json({ success: false, message: 'Data melebihi panjang maksimum yang diizinkan.' });
    }
    if (sqlstate === '22003') {
      return res.status(400).json({ success: false, message: 'Nilai melebihi batas yang diizinkan.' });
    }
    if (sqlstate === '22007' || sqlstate === '22008' || sqlstate === '22P02') {
      return res.status(400).json({ success: false, message: 'Parameter atau nilai tanggal tidak valid.' });
    }
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: error?.message
  });
}
