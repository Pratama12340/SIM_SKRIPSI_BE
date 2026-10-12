import express from 'express';
import {
  getAllPengajuan,
  getPengajuanById,
  submitPengajuan,
  updateStatusPengajuan,
  deletePengajuan
} from '../controllers/pengajuanController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { uploadPdf } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Semua rute pengajuan membutuhkan token JWT
router.use(verifyToken);

router.get('/', getAllPengajuan);
router.get('/:id', getPengajuanById);

// Submit pengajuan & upload proposal (Hanya mahasiswa)
router.post('/submit', requireRole('MAHASISWA'), uploadPdf.single('file_proposal'), submitPengajuan);

// Verifikasi & penetapan pembimbing (Dosen / Kaprodi / Admin)
router.put('/:id/status', requireRole('DOSEN', 'KAPRODI', 'ADMIN_PRODI', 'ADMIN'), updateStatusPengajuan);

// Hapus draft pengajuan
router.delete('/:id', deletePengajuan);

export default router;
