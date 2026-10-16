import prisma from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { sendError, parseId } from '../utils/apiHelpers.js';
import { buildScopeCondition, assertCanAccessSkripsi } from '../utils/scopeFilter.js';

/**
 * Mendaftar seminar proposal (sempro), seminar hasil (semhas), atau sidang skripsi akhir (Mahasiswa).
 */
export async function daftarSeminar(req, res) {
  try {
    const { nim_nip } = req.user;
    const { skripsi_id, jenis_sidang } = req.body;

    const validJenis = ['sempro', 'semhas', 'sidang_akhir'];
    if (!skripsi_id || !jenis_sidang || !validJenis.includes(jenis_sidang)) {
      return res.status(400).json({
        success: false,
        message: `Parameter skripsi_id dan jenis_sidang (${validJenis.join(', ')}) wajib diisi dengan benar.`
      });
    }

    const skripsiId = Number(skripsi_id);
    if (!Number.isInteger(skripsiId)) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    // Pastikan skripsi milik mahasiswa ini dan sudah disetujui
    const skripsiRows = await prisma.$queryRaw`
      SELECT id, status, nim FROM pengajuan_skripsi WHERE id = ${skripsiId}`;

    if (skripsiRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    if (skripsiRows[0].nim !== nim_nip) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki hak akses untuk mendaftarkan skripsi ini.'
      });
    }

    if (skripsiRows[0].status !== 'disetujui') {
      return res.status(400).json({
        success: false,
        message: 'Skripsi harus berstatus disetujui sebelum mendaftar seminar/sidang!'
      });
    }

    // Cek apakah sudah ada pendaftaran sejenis yang berstatus menunggu_jadwal atau terjadwal
    const activeSidang = await prisma.$queryRaw`
      SELECT id, status FROM pendaftaran_sidang
       WHERE skripsi_id = ${skripsiId} AND jenis_sidang = ${jenis_sidang}
         AND status IN ('menunggu_jadwal', 'terjadwal')`;

    if (activeSidang.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Anda sudah memiliki pendaftaran ${jenis_sidang} yang sedang diproses.`
      });
    }

    const file_naskah = req.file ? req.file.filename : null;

    // INSERT ... WHERE NOT EXISTS membuat pemeriksaan ganda & penyisipan atomik
    // dalam satu statement (tanpa butuh transaksi).
    const inserted = await prisma.$queryRaw`
      INSERT INTO pendaftaran_sidang (skripsi_id, jenis_sidang, file_naskah, status)
      SELECT ${skripsiId}, ${jenis_sidang}, ${file_naskah}, 'menunggu_jadwal'
      WHERE NOT EXISTS (
        SELECT 1 FROM pendaftaran_sidang
        WHERE skripsi_id = ${skripsiId} AND jenis_sidang = ${jenis_sidang}
          AND status IN ('menunggu_jadwal', 'terjadwal')
      )
      RETURNING id`;

    if (inserted.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Anda sudah memiliki pendaftaran ${jenis_sidang} yang sedang diproses.`
      });
    }

    return res.status(201).json({
      success: true,
      message: `Pendaftaran ${jenis_sidang} berhasil diajukan! Menunggu plotting jadwal dari program studi.`,
      data: {
        id: inserted[0].id,
        skripsi_id,
        jenis_sidang,
        file_naskah,
        status: 'menunggu_jadwal'
      }
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mendaftar seminar/sidang');
  }
}

/**
 * Melihat daftar jadwal seminar & sidang skripsi.
 */
export async function getJadwalSeminar(req, res) {
  try {
    const { jenis_sidang, status, skripsi_id, prodi_id } = req.query;

    const conditions = [Prisma.sql`TRUE`];

    // Terapkan isolasi data berbasis Scope (ADMIN, ADMIN_DEKANAT, ADMIN_PRODI, KAPRODI, MAHASISWA)
    const scopeCondition = await buildScopeCondition(req.user, {
      prodiColumn: 'p.prodi_id',
      nimColumn: 'p.nim',
      requestedProdiId: prodi_id || null
    });
    conditions.push(scopeCondition);

    if (jenis_sidang) {
      conditions.push(Prisma.sql`s.jenis_sidang = ${jenis_sidang}`);
    }

    if (status) {
      conditions.push(Prisma.sql`s.status = ${status}`);
    }

    if (skripsi_id) {
      const skripsiId = Number(skripsi_id);
      if (!Number.isInteger(skripsiId)) {
        return res.status(400).json({ success: false, message: 'Parameter skripsi_id tidak valid.' });
      }
      conditions.push(Prisma.sql`s.skripsi_id = ${skripsiId}`);
    }

    const where = Prisma.join(conditions, ' AND ');

    // NULLS FIRST pada jadwal_sidang mempertahankan urutan lama MySQL (ASC -> NULL dulu)
    // nilai_akhir::text mempertahankan kontrak DECIMAL lama (string "88.50" -> bukan objek)
    const rows = await prisma.$queryRaw`
      SELECT s.*,
        p.nim, p.nama_mahasiswa, p.judul, p.prodi_id,
        p.dosen_pembimbing_1_nip, p.dosen_pembimbing_1_nama,
        p.dosen_pembimbing_2_nip, p.dosen_pembimbing_2_nama,
        s.nilai_akhir::text AS nilai_akhir
      FROM pendaftaran_sidang s
      JOIN pengajuan_skripsi p ON s.skripsi_id = p.id
      WHERE ${where}
      ORDER BY s.jadwal_sidang ASC NULLS FIRST, s.created_at DESC`;

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil jadwal seminar/sidang');
  }
}

/**
 * Mengatur jadwal, ruangan, dan status seminar/sidang (Dosen / Kaprodi / Admin).
 */
export async function updateJadwalSeminar(req, res) {
  try {
    const id = parseId(req.params.id);
    const { jadwal_sidang, ruangan, status } = req.body;

    const validStatus = ['menunggu_jadwal', 'terjadwal', 'lulus', 'revisi'];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Harus salah satu dari: ${validStatus.join(', ')}`
      });
    }

    if (!id) {
      return res.status(404).json({
        success: false,
        message: 'Data pendaftaran sidang tidak ditemukan'
      });
    }

    const existing = await prisma.$queryRaw`
      SELECT s.id, p.prodi_id, p.nim
      FROM pendaftaran_sidang s
      JOIN pengajuan_skripsi p ON s.skripsi_id = p.id
      WHERE s.id = ${id}`;

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pendaftaran sidang tidak ditemukan'
      });
    }

    const canAccess = await assertCanAccessSkripsi(req.user, existing[0]);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengatur jadwal sidang prodi/fakultas ini.'
      });
    }

    await prisma.$executeRaw`
      UPDATE pendaftaran_sidang SET
        jadwal_sidang = COALESCE(${jadwal_sidang || null}::timestamptz, jadwal_sidang),
        ruangan = COALESCE(${ruangan || null}, ruangan),
        status = COALESCE(${status || null}, status)
       WHERE id = ${id}`;

    return res.json({
      success: true,
      message: 'Jadwal dan status sidang berhasil diperbarui!'
    });
  } catch (error) {
    return sendError(res, error, 'Gagal memperbarui jadwal seminar/sidang');
  }
}
