import express from 'express';
import { inputNilaiSidang, getNilaiSidang } from '../controllers/nilaiController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/:id', getNilaiSidang);

// Input nilai dan catatan ujian (Dosen Penguji / Kaprodi / Admin)
router.put('/:id', requireRole('DOSEN', 'KAPRODI', 'ADMIN_PRODI', 'ADMIN'), inputNilaiSidang);

export default router;
