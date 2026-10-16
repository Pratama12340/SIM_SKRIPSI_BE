import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const SSO_BASE_URL = process.env.SIM_MHS_API_URL || 'https://sim-mhs-api.vercel.app/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_bersama_sim_mahasiswa_sso';

// In-memory cache untuk token SSO eksternal (token -> { user, exp })
const tokenCache = new Map();

/**
 * Middleware untuk memverifikasi access token JWT SSO.
 * Mendukung verifikasi internal (JWT_SECRET) dan verifikasi sentral via SSO sim-mhs-api.
 */
export async function verifyToken(req, res, next) {
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

  // 1. Coba verifikasi lokal menggunakan JWT_SECRET
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: decoded.sub ? String(decoded.sub) : (decoded.id ? String(decoded.id) : null),
      nim_nip: decoded.username || decoded.nim_nip || decoded.nim || decoded.nip || '',
      nama: decoded.nama || decoded.namaLengkap || 'Pengguna',
      role: (decoded.role || '').toUpperCase(),
      prodi_id: decoded.scope?.idProgramStudi ? parseInt(decoded.scope.idProgramStudi, 10) : (decoded.prodi_id ? parseInt(decoded.prodi_id, 10) : null),
      fakultas_id: decoded.scope?.idFakultas ? parseInt(decoded.scope.idFakultas, 10) : (decoded.fakultas_id ? parseInt(decoded.fakultas_id, 10) : null),
      scope: decoded.scope || null,
      raw: decoded
    };

    return next();
  } catch (localError) {
    if (localError.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token telah kedaluwarsa. Silakan perbarui sesi login Anda.'
      });
    }

    // 2. Cek cache in-memory untuk remote SSO token
    const cached = tokenCache.get(token);
    if (cached && cached.exp > Date.now()) {
      req.user = cached.user;
      return next();
    }

    // 3. Verifikasi remote ke server SSO sim-mhs-api (/auth/me)
    try {
      const ssoRes = await fetch(`${SSO_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (ssoRes.ok) {
        const ssoData = await ssoRes.json();
        if (ssoData.success && ssoData.data) {
          const u = ssoData.data;
          const roleCode = (u.role?.kodeRole || u.role || 'MAHASISWA').toUpperCase();
          const prodiId = u.idProgramStudi ? parseInt(u.idProgramStudi, 10) : null;

          const verifiedUser = {
            id: String(u.id),
            nim_nip: u.username || '',
            nama: u.namaLengkap || u.username || 'Pengguna',
            role: roleCode,
            prodi_id: prodiId,
            fakultas_id: u.idFakultas ? parseInt(u.idFakultas, 10) : null,
            scope: {
              idUniversitas: u.idUniversitas ? String(u.idUniversitas) : '1',
              idFakultas: u.idFakultas ? String(u.idFakultas) : null,
              idProgramStudi: prodiId ? String(prodiId) : null
            },
            raw: u
          };

          // Simpan di cache selama 5 menit
          tokenCache.set(token, {
            user: verifiedUser,
            exp: Date.now() + (5 * 60 * 1000)
          });

          req.user = verifiedUser;
          return next();
        }
      }
    } catch (ssoError) {
      console.warn('[authMiddleware] Gagal verifikasi SSO remote:', ssoError.message);
    }

    // 4. Fallback decode bila token berasal dari issuer sim-mhs-api
    const decodedWithoutVerify = jwt.decode(token);
    if (decodedWithoutVerify && decodedWithoutVerify.iss === 'sim-mhs-api') {
      if (decodedWithoutVerify.exp && decodedWithoutVerify.exp * 1000 < Date.now()) {
        return res.status(401).json({
          success: false,
          message: 'Token SSO telah kedaluwarsa. Silakan perbarui sesi login Anda.'
        });
      }

      req.user = {
        id: decodedWithoutVerify.sub ? String(decodedWithoutVerify.sub) : null,
        nim_nip: decodedWithoutVerify.username || '',
        nama: decodedWithoutVerify.nama || 'Pengguna',
        role: (decodedWithoutVerify.role || '').toUpperCase(),
        prodi_id: decodedWithoutVerify.scope?.idProgramStudi ? parseInt(decodedWithoutVerify.scope.idProgramStudi, 10) : null,
        fakultas_id: decodedWithoutVerify.scope?.idFakultas ? parseInt(decodedWithoutVerify.scope.idFakultas, 10) : null,
        scope: decodedWithoutVerify.scope || null,
        raw: decodedWithoutVerify
      };
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Token tidak valid atau signature tidak cocok.',
      error: localError.message
    });
  }
}

/**
 * Middleware untuk membatasi akses endpoint berdasarkan hak peran (Role-based Guard).
 * @param {string[]} allowedRoles - Daftar role yang diizinkan (misal: ['MAHASISWA', 'DOSEN'])
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

  // Pemetaan alias peran yang saling berpadanan dalam struktur akademik
  const roleAliases = {
    ADMIN_PRODI: ['KAPRODI', 'ADMIN_PRODI'],
    KAPRODI: ['KAPRODI', 'ADMIN_PRODI'],
    ADMIN_DEKANAT: ['DEKANAT', 'ADMIN_DEKANAT'],
    DEKANAT: ['DEKANAT', 'ADMIN_DEKANAT']
  };

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Data identitas role tidak ditemukan.'
      });
    }

    const currentRole = req.user.role.toUpperCase();

    // 1. Role ADMIN universitas selalu memiliki izin penuh ke seluruh endpoint
    if (currentRole === 'ADMIN' || normalizedAllowed.includes(currentRole)) {
      return next();
    }

    // 2. Periksa kecocokan alias role (contoh: ADMIN_PRODI diizinkan pada guard KAPRODI dan sebaliknya)
    const aliases = roleAliases[currentRole] || [];
    const isAllowedViaAlias = aliases.some(alias => normalizedAllowed.includes(alias));
    if (isAllowedViaAlias) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Akses ditolak: Peran Anda (${req.user.role}) tidak memiliki hak akses untuk aksi ini.`
    });
  };
}
