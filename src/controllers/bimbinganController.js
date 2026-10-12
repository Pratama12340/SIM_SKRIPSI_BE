import pool from '../config/database.js';

/**
 * Mengambil riwayat logbook bimbingan berdasarkan ID skripsi.
 */
export async function getBimbinganBySkripsiId(req, res) {
  try {
    const { skripsiId } = req.params;

    const [rows] = await pool.query(
      `SELECT b.*, p.judul, p.nama_mahasiswa, p.nim
       FROM logbook_bimbingan b
       JOIN pengajuan_skripsi p ON b.skripsi_id = p.id
       WHERE b.skripsi_id = ?
       ORDER BY b.tanggal_bimbingan DESC, b.id DESC`,
      [skripsiId]
    );

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('[Error getBimbinganBySkripsiId]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat bimbingan',
      error: error.message
    });
  }
}

/**
 * Menambahkan catatan logbook bimbingan baru (Mahasiswa).
 */
export async function tambahBimbingan(req, res) {
  try {
    const { nim_nip } = req.user;
    const { skripsi_id, dosen_nip, dosen_nama, tanggal_bimbingan, catatan_mahasiswa } = req.body;

    if (!skripsi_id || !dosen_nip || !tanggal_bimbingan || !catatan_mahasiswa) {
      return res.status(400).json({
        success: false,
        message: 'Field skripsi_id, dosen_nip, tanggal_bimbingan, dan catatan_mahasiswa wajib diisi!'
      });
    }

    // Pastikan skripsi berstatus disetujui
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

    if (skripsiRows[0].status !== 'disetujui') {
      return res.status(400).json({
        success: false,
        message: 'Bimbingan hanya dapat diajukan jika judul skripsi telah disetujui!'
      });
    }

    const file_revisi = req.file ? req.file.filename : null;

    const [result] = await pool.query(
      `INSERT INTO logbook_bimbingan 
        (skripsi_id, nim, dosen_nip, dosen_nama, tanggal_bimbingan, catatan_mahasiswa, file_revisi, status_acc)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        skripsi_id,
        nim_nip,
        dosen_nip,
        dosen_nama || null,
        tanggal_bimbingan,
        catatan_mahasiswa,
        file_revisi
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Catatan bimbingan berhasil ditambahkan!',
      data: {
        id: result.insertId,
        skripsi_id,
        file_revisi,
        status_acc: 'pending'
      }
    });
  } catch (error) {
    console.error('[Error tambahBimbingan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan catatan bimbingan',
      error: error.message
    });
  }
}

/**
 * Memberikan catatan evaluasi revisi atau ACC bimbingan (Dosen).
 */
export async function accBimbingan(req, res) {
  try {
    const { id } = req.params;
    const { catatan_dosen, status_acc } = req.body;

    const validStatus = ['pending', 'revisi', 'acc'];
    if (status_acc && !validStatus.includes(status_acc)) {
      return res.status(400).json({
        success: false,
        message: `status_acc tidak valid. Harus salah satu dari: ${validStatus.join(', ')}`
      });
    }

    const [existing] = await pool.query(`SELECT id FROM logbook_bimbingan WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data logbook bimbingan tidak ditemukan'
      });
    }

    await pool.query(
      `UPDATE logbook_bimbingan SET
        catatan_dosen = COALESCE(?, catatan_dosen),
        status_acc = COALESCE(?, status_acc)
       WHERE id = ?`,
      [catatan_dosen || null, status_acc || null, id]
    );

    return res.json({
      success: true,
      message: 'Tanggapan dan status bimbingan berhasil diperbarui!'
    });
  } catch (error) {
    console.error('[Error accBimbingan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status bimbingan',
      error: error.message
    });
  }
}

/**
 * Menghapus logbook bimbingan (Hanya jika status masih pending).
 */
export async function deleteBimbingan(req, res) {
  try {
    const { id } = req.params;
    const { nim_nip, role } = req.user;

    let deleteQuery = `DELETE FROM logbook_bimbingan WHERE id = ?`;
    const params = [id];

    if (role === 'MAHASISWA') {
      deleteQuery += ` AND nim = ? AND status_acc = 'pending'`;
      params.push(nim_nip);
    }

    const [result] = await pool.query(deleteQuery, params);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Logbook tidak dapat dihapus (sudah direspon dosen atau bukan milik Anda).'
      });
    }

    return res.json({
      success: true,
      message: 'Catatan bimbingan berhasil dihapus'
    });
  } catch (error) {
    console.error('[Error deleteBimbingan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus catatan bimbingan',
      error: error.message
    });
  }
}
