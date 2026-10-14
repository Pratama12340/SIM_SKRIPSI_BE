import express from 'express';
import {
  login,
  me,
  refreshToken,
  getTestAccounts
} from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Autentikasi akun pengguna SSO sim-mhs-api (ADMIN, ADMIN_PRODI, ADMIN_DEKANAT, DOSEN, MAHASISWA)
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Memperbarui access token dengan refresh token SSO
 * @access  Public
 */
router.post('/refresh', refreshToken);

/**
 * @route   GET /api/auth/accounts
 * @desc    Mendapatkan daftar akun uji coba resmi SSO untuk 5 role
 * @access  Public
 */
router.get('/accounts', getTestAccounts);

/**
 * @route   GET /api/auth/me
 * @desc    Mendapatkan data identitas profil pengguna yang sedang login
 * @access  Protected (Bearer JWT)
 */
router.get('/me', verifyToken, me);

export default router;
