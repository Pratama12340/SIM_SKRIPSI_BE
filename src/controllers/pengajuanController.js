import pool from '../config/database.js';

/**
 * Mengambil daftar pengajuan skripsi.
 * Otomatis terfilter sesuai role pengguna (Mahasiswa = pengajuan miliknya, Dosen = bimbingannya / prodi).
 */
export async function getAllPengajuan(req, res) {
  try {
    const { role, nim_nip } = req.user;
    const { status, prodi_id } = req.query;

    let query = `
      SELECT p.*,
        (SELECT COUNT(*) FROM logbook_bimbingan WHERE skripsi_id = p.id) AS total_bimbingan,
        (SELECT COUNT(*) FROM logbook_bimbingan WHERE skripsi_id = p.id AND status_acc = 'acc') AS total_bimbingan_acc
      FROM pengajuan_skripsi p
      WHERE 1=1
    `;
    const params = [];

    if (role === 'MAHASISWA') {
      query += ` AND p.nim = ?`;
      params.push(nim_nip);
    } else if (role === 'DOSEN') {
      // Dosen melihat yang dibimbingnya atau seluruh pengajuan di prodi
      if (req.query.scope === 'bimbingan') {
        query += ` AND (p.dosen_pembimbing_1_nip = ? OR p.dosen_pembimbing_2_nip = ?)`;
        params.push(nim_nip, nim_nip);
      }
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (prodi_id) {
      query += ` AND p.prodi_id = ?`;
      params.push(prodi_id);
    }

    query += ` ORDER BY p.created_at DESC`;

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('[Error getAllPengajuan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data pengajuan skripsi',
      error: error.message
    });
  }
}

/**
 * Mengambil detail pengajuan skripsi berdasarkan ID.
 */
export async function getPengajuanById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`SELECT * FROM pengajuan_skripsi WHERE id = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    const pengajuan = rows[0];

    // Ambil riwayat logbook bimbingan
    const [logbooks] = await pool.query(
      `SELECT * FROM logbook_bimbingan WHERE skripsi_id = ? ORDER BY tanggal_bimbingan DESC`,
      [id]
    );

    // Ambil riwayat sidang
    const [sidangs] = await pool.query(
      `SELECT * FROM pendaftaran_sidang WHERE skripsi_id = ? ORDER BY created_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...pengajuan,
        logbooks,
        sidangs
      }
    });
  } catch (error) {
    console.error('[Error getPengajuanById]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail pengajuan skripsi',
      error: error.message
    });
  }
}

/**
 * Mengajukan draf judul baru & unggah proposal skripsi (Mahasiswa).
 */
export async function submitPengajuan(req, res) {
  try {
    const { nim_nip, nama, prodi_id } = req.user;
    const { judul, bidang_kajian, abstrak, status = 'diajukan' } = req.body;

    if (!judul || !judul.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Judul skripsi wajib diisi!'
      });
    }

    // Nama file proposal jika ada unggahan
    const file_proposal = req.file ? req.file.filename : null;

    const [result] = await pool.query(
      `INSERT INTO pengajuan_skripsi 
        (nim, nama_mahasiswa, prodi_id, judul, bidang_kajian, abstrak, file_proposal, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nim_nip,
        nama,
        prodi_id || req.body.prodi_id || null,
        judul.trim(),
        bidang_kajian || null,
        abstrak || null,
        file_proposal,
        status
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Pengajuan judul skripsi berhasil disubmit!',
      data: {
        id: result.insertId,
        judul,
        file_proposal,
        status
      }
    });
  } catch (error) {
    console.error('[Error submitPengajuan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses pengajuan skripsi',
      error: error.message
    });
  }
}

/**
 * Memperbarui status pengajuan skripsi dan penetapan pembimbing (Dosen / Kaprodi / Admin).
 */
export async function updateStatusPengajuan(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      dosen_pembimbing_1_nip,
      dosen_pembimbing_1_nama,
      dosen_pembimbing_2_nip,
      dosen_pembimbing_2_nama,
      catatan_verifikasi
    } = req.body;

    const validStatus = ['draft', 'diajukan', 'disetujui', 'ditolak'];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Harus salah satu dari: ${validStatus.join(', ')}`
      });
    }

    // Cek keberadaan data
    const [existing] = await pool.query(`SELECT id FROM pengajuan_skripsi WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    await pool.query(
      `UPDATE pengajuan_skripsi SET
        status = COALESCE(?, status),
        dosen_pembimbing_1_nip = COALESCE(?, dosen_pembimbing_1_nip),
        dosen_pembimbing_1_nama = COALESCE(?, dosen_pembimbing_1_nama),
        dosen_pembimbing_2_nip = COALESCE(?, dosen_pembimbing_2_nip),
        dosen_pembimbing_2_nama = COALESCE(?, dosen_pembimbing_2_nama),
        catatan_verifikasi = COALESCE(?, catatan_verifikasi)
       WHERE id = ?`,
      [
        status || null,
        dosen_pembimbing_1_nip || null,
        dosen_pembimbing_1_nama || null,
        dosen_pembimbing_2_nip || null,
        dosen_pembimbing_2_nama || null,
        catatan_verifikasi || null,
        id
      ]
    );

    return res.json({
      success: true,
      message: 'Status pengajuan dan dosen pembimbing berhasil diperbarui!'
    });
  } catch (error) {
    console.error('[Error updateStatusPengajuan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status pengajuan skripsi',
      error: error.message
    });
  }
}

/**
 * Menghapus draf pengajuan skripsi.
 */
export async function deletePengajuan(req, res) {
  try {
    const { id } = req.params;
    const { role, nim_nip } = req.user;

    let deleteQuery = `DELETE FROM pengajuan_skripsi WHERE id = ?`;
    const params = [id];

    // Jika mahasiswa, hanya boleh menghapus draf miliknya
    if (role === 'MAHASISWA') {
      deleteQuery += ` AND nim = ? AND status = 'draft'`;
      params.push(nim_nip);
    }

    const [result] = await pool.query(deleteQuery, params);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pengajuan tidak dapat dihapus (mungkin bukan status draft atau bukan milik Anda).'
      });
    }

    return res.json({
      success: true,
      message: 'Pengajuan skripsi berhasil dihapus'
    });
  } catch (error) {
    console.error('[Error deletePengajuan]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus pengajuan skripsi',
      error: error.message
    });
  }
}
