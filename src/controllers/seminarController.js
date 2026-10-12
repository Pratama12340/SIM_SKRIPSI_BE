import pool from '../config/database.js';

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

    // Pastikan skripsi milik mahasiswa ini dan sudah disetujui
    const [skripsiRows] = await pool.query(
      `SELECT id, status, nim FROM pengajuan_skripsi WHERE id = ?`,
      [skripsi_id]
    );

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
    const [activeSidang] = await pool.query(
      `SELECT id, status FROM pendaftaran_sidang 
       WHERE skripsi_id = ? AND jenis_sidang = ? AND status IN ('menunggu_jadwal', 'terjadwal')`,
      [skripsi_id, jenis_sidang]
    );

    if (activeSidang.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Anda sudah memiliki pendaftaran ${jenis_sidang} yang sedang diproses.`
      });
    }

    const file_naskah = req.file ? req.file.filename : null;

    const [result] = await pool.query(
      `INSERT INTO pendaftaran_sidang 
        (skripsi_id, jenis_sidang, file_naskah, status)
       VALUES (?, ?, ?, 'menunggu_jadwal')`,
      [skripsi_id, jenis_sidang, file_naskah]
    );

    return res.status(201).json({
      success: true,
      message: `Pendaftaran ${jenis_sidang} berhasil diajukan! Menunggu plotting jadwal dari program studi.`,
      data: {
        id: result.insertId,
        skripsi_id,
        jenis_sidang,
        file_naskah,
        status: 'menunggu_jadwal'
      }
    });
  } catch (error) {
    console.error('[Error daftarSeminar]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mendaftar seminar/sidang',
      error: error.message
    });
  }
}

/**
 * Melihat daftar jadwal seminar & sidang skripsi.
 */
export async function getJadwalSeminar(req, res) {
  try {
    const { jenis_sidang, status, skripsi_id } = req.query;

    let query = `
      SELECT s.*, 
        p.nim, p.nama_mahasiswa, p.judul, p.prodi_id,
        p.dosen_pembimbing_1_nip, p.dosen_pembimbing_1_nama,
        p.dosen_pembimbing_2_nip, p.dosen_pembimbing_2_nama
      FROM pendaftaran_sidang s
      JOIN pengajuan_skripsi p ON s.skripsi_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (jenis_sidang) {
      query += ` AND s.jenis_sidang = ?`;
      params.push(jenis_sidang);
    }

    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    if (skripsi_id) {
      query += ` AND s.skripsi_id = ?`;
      params.push(skripsi_id);
    }

    query += ` ORDER BY s.jadwal_sidang ASC, s.created_at DESC`;

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('[Error getJadwalSeminar]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil jadwal seminar/sidang',
      error: error.message
    });
  }
}

/**
 * Mengatur jadwal, ruangan, dan status seminar/sidang (Dosen / Kaprodi / Admin).
 */
export async function updateJadwalSeminar(req, res) {
  try {
    const { id } = req.params;
    const { jadwal_sidang, ruangan, status } = req.body;

    const validStatus = ['menunggu_jadwal', 'terjadwal', 'lulus', 'revisi'];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Harus salah satu dari: ${validStatus.join(', ')}`
      });
    }

    const [existing] = await pool.query(`SELECT id FROM pendaftaran_sidang WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pendaftaran sidang tidak ditemukan'
      });
    }

    await pool.query(
      `UPDATE pendaftaran_sidang SET
        jadwal_sidang = COALESCE(?, jadwal_sidang),
        ruangan = COALESCE(?, ruangan),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [jadwal_sidang || null, ruangan || null, status || null, id]
    );

    return res.json({
      success: true,
      message: 'Jadwal dan status sidang berhasil diperbarui!'
    });
  } catch (error) {
    console.error('[Error updateJadwalSeminar]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui jadwal seminar/sidang',
      error: error.message
    });
  }
}
