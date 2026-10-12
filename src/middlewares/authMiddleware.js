import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Middleware untuk memverifikasi access token JWT SSO (sim-mhs-api).
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Header Authorization tidak ditemukan. Harap sertakan Bearer Token.'
    });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Format token tidak valid. Gunakan: Authorization: Bearer <token>'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'rahasia_bersama_sim_mahasiswa_sso';
    const decoded = jwt.verify(token, secret);

    // Normalisasi struktur user dari payload JWT (kompatibel dengan sim-mhs-api dan token lokal)
    req.user = {
      id: decoded.sub ? String(decoded.sub) : (decoded.id ? String(decoded.id) : null),
      nim_nip: decoded.username || decoded.nim_nip || decoded.nim || decoded.nip || '',
      nama: decoded.nama || decoded.namaLengkap || 'Pengguna',
      role: (decoded.role || '').toUpperCase(),
      prodi_id: decoded.scope?.idProgramStudi ? parseInt(decoded.scope.idProgramStudi, 10) : (decoded.prodi_id ? parseInt(decoded.prodi_id, 10) : null),
      scope: decoded.scope || null,
      raw: decoded
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token telah kedaluwarsa. Silakan perbarui sesi login Anda.'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Token tidak valid atau signature tidak cocok.',
      error: error.message
    });
  }
}

/**
 * Middleware untuk membatasi akses endpoint berdasarkan hak peran (Role-based Guard).
 * @param {string[]} allowedRoles - Daftar role yang diizinkan (misal: ['MAHASISWA', 'DOSEN'])
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Data identitas role tidak ditemukan.'
      });
    }

    // Role ADMIN selalu diizinkan untuk semua endpoint
    if (req.user.role === 'ADMIN' || normalizedAllowed.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Akses ditolak: Peran Anda (${req.user.role}) tidak memiliki hak akses untuk aksi ini.`
    });
  };
}
