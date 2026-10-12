import express from 'express';
import {
  daftarSeminar,
  getJadwalSeminar,
  updateJadwalSeminar
} from '../controllers/seminarController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { uploadPdf } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Jadwal dapat diakses untuk melihat jadwal sidang
router.get('/jadwal', getJadwalSeminar);

// Pendaftaran seminar / sidang (Mahasiswa yang login)
router.post('/daftar', verifyToken, requireRole('MAHASISWA'), uploadPdf.single('file_naskah'), daftarSeminar);

// Mengatur jadwal & ruangan ujian (Dosen / Kaprodi / Admin)
router.put('/:id/jadwal', verifyToken, requireRole('DOSEN', 'KAPRODI', 'ADMIN_PRODI', 'ADMIN'), updateJadwalSeminar);

export default router;
