import pool from '../config/database.js';

/**
 * Menginput atau memperbarui nilai akhir dan catatan sidang skripsi (Dosen / Penguji / Admin).
 */
export async function inputNilaiSidang(req, res) {
  try {
    const { id } = req.params; // ID pendaftaran_sidang
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

    const [existing] = await pool.query(`SELECT id FROM pendaftaran_sidang WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pendaftaran sidang tidak ditemukan'
      });
    }

    // Default status jika lulus (nilai >= 60) atau revisi
    const resolvedStatus = status || (nilaiNum >= 60 ? 'lulus' : 'revisi');

    await pool.query(
      `UPDATE pendaftaran_sidang SET
        nilai_akhir = ?,
        catatan_sidang = COALESCE(?, catatan_sidang),
        status = ?
       WHERE id = ?`,
      [nilaiNum, catatan_sidang || null, resolvedStatus, id]
    );

    return res.json({
      success: true,
      message: 'Nilai dan status kelulusan sidang berhasil disimpan!',
      data: {
        id,
        nilai_akhir: nilaiNum,
        status: resolvedStatus
      }
    });
  } catch (error) {
    console.error('[Error inputNilaiSidang]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menginput nilai sidang',
      error: error.message
    });
  }
}

/**
 * Mengambil ringkasan nilai dan rekap kelulusan skripsi.
 */
export async function getNilaiSidang(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT s.id, s.skripsi_id, s.jenis_sidang, s.nilai_akhir, s.catatan_sidang, s.status, s.jadwal_sidang,
              p.nim, p.nama_mahasiswa, p.judul
       FROM pendaftaran_sidang s
       JOIN pengajuan_skripsi p ON s.skripsi_id = p.id
       WHERE s.id = ?`,
      [id]
    );

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
    console.error('[Error getNilaiSidang]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data nilai sidang',
      error: error.message
    });
  }
}
