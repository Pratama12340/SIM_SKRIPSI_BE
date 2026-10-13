import prisma from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { sendError, parseId } from '../utils/apiHelpers.js';

/**
 * Mengambil daftar pengajuan skripsi.
 * Otomatis terfilter sesuai role pengguna (Mahasiswa = pengajuan miliknya, Dosen = bimbingannya / prodi).
 */
export async function getAllPengajuan(req, res) {
  try {
    const { role, nim_nip } = req.user;
    const { status, prodi_id } = req.query;

    const conditions = [Prisma.sql`TRUE`];

    if (role === 'MAHASISWA') {
      conditions.push(Prisma.sql`p.nim = ${nim_nip}`);
    } else if (role === 'DOSEN') {
      // Dosen melihat yang dibimbingnya atau seluruh pengajuan di prodi
      if (req.query.scope === 'bimbingan') {
        conditions.push(Prisma.sql`(p.dosen_pembimbing_1_nip = ${nim_nip} OR p.dosen_pembimbing_2_nip = ${nim_nip})`);
      }
    }

    if (status) {
      conditions.push(Prisma.sql`p.status = ${status}`);
    }

    if (prodi_id) {
      const prodiId = Number(prodi_id);
      if (!Number.isInteger(prodiId)) {
        return res.status(400).json({ success: false, message: 'Parameter prodi_id tidak valid.' });
      }
      conditions.push(Prisma.sql`p.prodi_id = ${prodiId}`);
    }

    const where = Prisma.join(conditions, ' AND ');

    // COUNT(*) di-cast ke int agar aman dari serialisasi BigInt di JSON
    const rows = await prisma.$queryRaw`
      SELECT p.*,
        (SELECT COUNT(*) FROM logbook_bimbingan WHERE skripsi_id = p.id)::int AS total_bimbingan,
        (SELECT COUNT(*) FROM logbook_bimbingan WHERE skripsi_id = p.id AND status_acc = 'acc')::int AS total_bimbingan_acc
      FROM pengajuan_skripsi p
      WHERE ${where}
      ORDER BY p.created_at DESC
    `;

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil data pengajuan skripsi');
  }
}

/**
 * Mengambil detail pengajuan skripsi berdasarkan ID.
 */
export async function getPengajuanById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    const rows = await prisma.$queryRaw`SELECT * FROM pengajuan_skripsi WHERE id = ${id}`;

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    const pengajuan = rows[0];

    // Ambil riwayat logbook bimbingan
    const logbooks = await prisma.$queryRaw`
      SELECT * FROM logbook_bimbingan WHERE skripsi_id = ${id}
      ORDER BY tanggal_bimbingan DESC`;

    // Ambil riwayat sidang (nilai_akhir::text mempertahankan kontrak DECIMAL string)
    const sidangs = await prisma.$queryRaw`
      SELECT *, nilai_akhir::text AS nilai_akhir FROM pendaftaran_sidang WHERE skripsi_id = ${id}
      ORDER BY created_at DESC`;

    return res.json({
      success: true,
      data: {
        ...pengajuan,
        logbooks,
        sidangs
      }
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil detail pengajuan skripsi');
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

    const rawProdi = prodi_id || req.body.prodi_id || null;
    const prodiId = rawProdi === null ? null : Number(rawProdi);
    if (rawProdi !== null && !Number.isInteger(prodiId)) {
      return res.status(400).json({ success: false, message: 'prodi_id tidak valid.' });
    }

    const inserted = await prisma.$queryRaw`
      INSERT INTO pengajuan_skripsi
        (nim, nama_mahasiswa, prodi_id, judul, bidang_kajian, abstrak, file_proposal, status)
      VALUES (${nim_nip}, ${nama}, ${prodiId}, ${judul.trim()}, ${bidang_kajian || null}, ${abstrak || null}, ${file_proposal}, ${status})
      RETURNING id`;

    return res.status(201).json({
      success: true,
      message: 'Pengajuan judul skripsi berhasil disubmit!',
      data: {
        id: inserted[0].id,
        judul,
        file_proposal,
        status
      }
    });
  } catch (error) {
    return sendError(res, error, 'Gagal memproses pengajuan skripsi');
  }
}

/**
 * Memperbarui status pengajuan skripsi dan penetapan pembimbing (Dosen / Kaprodi / Admin).
 */
export async function updateStatusPengajuan(req, res) {
  try {
    const id = parseId(req.params.id);
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

    if (!id) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    // Cek keberadaan data
    const existing = await prisma.$queryRaw`SELECT id FROM pengajuan_skripsi WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    // Semua field bersifat opsional (COALESCE): nilai null/kosong mempertahankan data lama
    await prisma.$executeRaw`
      UPDATE pengajuan_skripsi SET
        status = COALESCE(${status || null}, status),
        dosen_pembimbing_1_nip = COALESCE(${dosen_pembimbing_1_nip || null}, dosen_pembimbing_1_nip),
        dosen_pembimbing_1_nama = COALESCE(${dosen_pembimbing_1_nama || null}, dosen_pembimbing_1_nama),
        dosen_pembimbing_2_nip = COALESCE(${dosen_pembimbing_2_nip || null}, dosen_pembimbing_2_nip),
        dosen_pembimbing_2_nama = COALESCE(${dosen_pembimbing_2_nama || null}, dosen_pembimbing_2_nama),
        catatan_verifikasi = COALESCE(${catatan_verifikasi || null}, catatan_verifikasi)
       WHERE id = ${id}`;

    return res.json({
      success: true,
      message: 'Status pengajuan dan dosen pembimbing berhasil diperbarui!'
    });
  } catch (error) {
    return sendError(res, error, 'Gagal memperbarui status pengajuan skripsi');
  }
}

/**
 * Menghapus draf pengajuan skripsi.
 */
export async function deletePengajuan(req, res) {
  try {
    const id = parseId(req.params.id);
    const { role, nim_nip } = req.user;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Pengajuan tidak dapat dihapus (mungkin bukan status draft atau bukan milik Anda).'
      });
    }

    let deleteQuery = Prisma.sql`DELETE FROM pengajuan_skripsi WHERE id = ${id}`;

    // Jika mahasiswa, hanya boleh menghapus draf miliknya
    if (role === 'MAHASISWA') {
      deleteQuery = Prisma.sql`DELETE FROM pengajuan_skripsi WHERE id = ${id} AND nim = ${nim_nip} AND status = 'draft'`;
    }

    const affected = await prisma.$executeRaw(deleteQuery);

    if (affected === 0) {
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
    return sendError(res, error, 'Gagal menghapus pengajuan skripsi');
  }
}
