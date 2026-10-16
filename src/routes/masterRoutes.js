import { Router } from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getFakultas,
  getProgramStudi,
  getScopeInfo,
  getMahasiswa
} from '../controllers/masterController.js';

const router = Router();

// Semua endpoint master data wajib terautentikasi (verifyToken)
router.use(verifyToken);

router.get('/fakultas', getFakultas);
router.get('/program-studi', getProgramStudi);
router.get('/scope', getScopeInfo);
router.get('/mahasiswa', getMahasiswa);

export default router;
