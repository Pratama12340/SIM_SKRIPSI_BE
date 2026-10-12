import express from 'express';
import {
  getBimbinganBySkripsiId,
  tambahBimbingan,
  accBimbingan,
  deleteBimbingan
} from '../controllers/bimbinganController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { uploadPdf } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/:skripsiId', getBimbinganBySkripsiId);

// Tambah entri logbook baru & upload naskah revisi (Mahasiswa)
router.post('/tambah', requireRole('MAHASISWA'), uploadPdf.single('file_revisi'), tambahBimbingan);

// Memberikan catatan revisi & status ACC (Dosen)
router.put('/:id/acc', requireRole('DOSEN', 'KAPRODI', 'ADMIN_PRODI', 'ADMIN'), accBimbingan);

// Hapus logbook pending
router.delete('/:id', deleteBimbingan);

export default router;
