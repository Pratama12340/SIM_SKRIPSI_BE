import prisma from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { sendError, parseId } from '../utils/apiHelpers.js';
import { assertCanAccessSkripsi } from '../utils/scopeFilter.js';

/**
 * Mengambil riwayat logbook bimbingan berdasarkan ID skripsi.
 */
export async function getBimbinganBySkripsiId(req, res) {
  try {
    const skripsiId = parseId(req.params.skripsiId);
    if (!skripsiId) {
      return res.json({ success: true, total: 0, data: [] });
    }

    const rows = await prisma.$queryRaw`
      SELECT b.*, p.judul, p.nama_mahasiswa, p.nim
       FROM logbook_bimbingan b
       JOIN pengajuan_skripsi p ON b.skripsi_id = p.id
       WHERE b.skripsi_id = ${skripsiId}
       ORDER BY b.tanggal_bimbingan DESC, b.id DESC`;

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil riwayat bimbingan');
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

    const skripsiId = Number(skripsi_id);
    if (!Number.isInteger(skripsiId)) {
      return res.status(404).json({
        success: false,
        message: 'Data pengajuan skripsi tidak ditemukan'
      });
    }

    // Pastikan skripsi berstatus disetujui
    const skripsiRows = await prisma.$queryRaw`
      SELECT id, status, nim FROM pengajuan_skripsi WHERE id = ${skripsiId}`;

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

    const inserted = await prisma.$queryRaw`
      INSERT INTO logbook_bimbingan
        (skripsi_id, nim, dosen_nip, dosen_nama, tanggal_bimbingan, catatan_mahasiswa, file_revisi, status_acc)
       VALUES (${skripsiId}, ${nim_nip}, ${dosen_nip}, ${dosen_nama || null}, ${tanggal_bimbingan}::date, ${catatan_mahasiswa}, ${file_revisi}, 'pending')
       RETURNING id`;

    return res.status(201).json({
      success: true,
      message: 'Catatan bimbingan berhasil ditambahkan!',
      data: {
        id: inserted[0].id,
        skripsi_id,
        file_revisi,
        status_acc: 'pending'
      }
    });
  } catch (error) {
    return sendError(res, error, 'Gagal menambahkan catatan bimbingan');
  }
}

/**
 * Memberikan catatan evaluasi revisi atau ACC bimbingan (Dosen).
 */
export async function accBimbingan(req, res) {
  try {
    const id = parseId(req.params.id);
    const { catatan_dosen, status_acc } = req.body;

    const validStatus = ['pending', 'revisi', 'acc'];
    if (status_acc && !validStatus.includes(status_acc)) {
      return res.status(400).json({
        success: false,
        message: `status_acc tidak valid. Harus salah satu dari: ${validStatus.join(', ')}`
      });
    }

    if (!id) {
      return res.status(404).json({
        success: false,
        message: 'Data logbook bimbingan tidak ditemukan'
      });
    }

    const existing = await prisma.$queryRaw`
      SELECT b.id, p.prodi_id, p.nim
      FROM logbook_bimbingan b
      JOIN pengajuan_skripsi p ON b.skripsi_id = p.id
      WHERE b.id = ${id}`;

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data logbook bimbingan tidak ditemukan'
      });
    }

    const canAccess = await assertCanAccessSkripsi(req.user, existing[0]);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk merespon bimbingan dari prodi/fakultas ini.'
      });
    }

    await prisma.$executeRaw`
      UPDATE logbook_bimbingan SET
        catatan_dosen = COALESCE(${catatan_dosen || null}, catatan_dosen),
        status_acc = COALESCE(${status_acc || null}, status_acc)
       WHERE id = ${id}`;

    return res.json({
      success: true,
      message: 'Tanggapan dan status bimbingan berhasil diperbarui!'
    });
  } catch (error) {
    return sendError(res, error, 'Gagal memperbarui status bimbingan');
  }
}

/**
 * Menghapus logbook bimbingan (Hanya jika status masih pending).
 */
export async function deleteBimbingan(req, res) {
  try {
    const id = parseId(req.params.id);
    const { nim_nip, role } = req.user;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Logbook tidak dapat dihapus (sudah direspon dosen atau bukan milik Anda).'
      });
    }

    let deleteQuery = Prisma.sql`DELETE FROM logbook_bimbingan WHERE id = ${id}`;

    if (role === 'MAHASISWA') {
      deleteQuery = Prisma.sql`DELETE FROM logbook_bimbingan WHERE id = ${id} AND nim = ${nim_nip} AND status_acc = 'pending'`;
    }

    const affected = await prisma.$executeRaw(deleteQuery);

    if (affected === 0) {
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
    return sendError(res, error, 'Gagal menghapus catatan bimbingan');
  }
}
