import prisma from '../config/database.js';
import { sendError, parseId } from '../utils/apiHelpers.js';
import { assertCanAccessSkripsi } from '../utils/scopeFilter.js';

/**
 * Menginput atau memperbarui nilai akhir dan catatan sidang skripsi (Dosen / Penguji / Admin).
 */
export async function inputNilaiSidang(req, res) {
  try {
    const id = parseId(req.params.id); // ID pendaftaran_sidang
    const { nilai_akhir, catatan_sidang, status } = req.body;

    if (nilai_akhir === undefined || nilai_akhir === null) {
      return res.status(400).json({
        success: false,
        message: 'Nilai akhir wajib diisi!'
      });
    }

    const nilaiNum = parseFloat(nilai_akhir);
    if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Nilai akhir harus berupa angka antara 0 dan 100.'
      });
    }

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
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk menilai sidang skripsi ini.'
      });
    }

    // Default status jika lulus (nilai >= 60) atau revisi
    const resolvedStatus = status || (nilaiNum >= 60 ? 'lulus' : 'revisi');

    await prisma.$executeRaw`
      UPDATE pendaftaran_sidang SET
        nilai_akhir = ${nilaiNum},
        catatan_sidang = COALESCE(${catatan_sidang || null}, catatan_sidang),
        status = ${resolvedStatus}
       WHERE id = ${id}`;

    return res.json({
      success: true,
      message: 'Nilai dan status kelulusan sidang berhasil disimpan!',
      data: {
        id: req.params.id,
        nilai_akhir: nilaiNum,
        status: resolvedStatus
      }
    });
  } catch (error) {
    return sendError(res, error, 'Gagal menginput nilai sidang');
  }
}

/**
 * Mengambil ringkasan nilai dan rekap kelulusan skripsi.
 */
export async function getNilaiSidang(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({
        success: false,
        message: 'Data nilai sidang tidak ditemukan'
      });
    }

    const rows = await prisma.$queryRaw`
      SELECT s.id, s.skripsi_id, s.jenis_sidang, s.nilai_akhir::text AS nilai_akhir, s.catatan_sidang, s.status, s.jadwal_sidang,
              p.nim, p.nama_mahasiswa, p.judul
       FROM pendaftaran_sidang s
       JOIN pengajuan_skripsi p ON s.skripsi_id = p.id
       WHERE s.id = ${id}`;

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data nilai sidang tidak ditemukan'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil data nilai sidang');
  }
}
