import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const SSO_BASE_URL = process.env.SIM_MHS_API_URL || 'https://sim-mhs-api.vercel.app/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_bersama_sim_mahasiswa_sso';
const JWT_ISSUER = process.env.JWT_ISSUER || 'sim-mhs-api';

/**
 * Daftar akun SSO resmi yang telah diverifikasi pada https://sim-mhs-api.vercel.app
 * untuk 5 peran pengguna dalam Sistem Informasi Manajemen Skripsi (SIM Skripsi).
 */
export const OFFICIAL_SSO_ACCOUNTS = [
  {
    role: 'ADMIN',
    roleLabel: 'Administrator Universitas',
    username: 'admin',
    nama: 'Administrator Sistem',
    keterangan: 'Akses penuh ke seluruh modul sistem skripsi'
  },
  {
    role: 'ADMIN_PRODI',
    roleLabel: 'Admin Program Studi (Operator)',
    username: 'adm_prodi_ti',
    nama: 'Operator Prodi TI',
    keterangan: 'Verifikasi pengajuan judul, plotting pembimbing, dan jadwal seminar prodi'
  },
  {
    role: 'KAPRODI',
    roleLabel: 'Ketua Program Studi',
    username: 'kaprodi_ti',
    nama: 'Dr. Ratna Sari, M.Kom.',
    keterangan: 'Persetujuan akhir judul skripsi dan pengesahan susunan dewan penguji'
  },
  {
    role: 'ADMIN_DEKANAT',
    roleLabel: 'Admin Dekanat Fakultas',
    username: 'adm_dekanat',
    nama: 'Staff Administrasi FTI',
    keterangan: 'Monitoring dan rekapitulasi data skripsi & sidang tingkat fakultas'
  },
  {
    role: 'DOSEN',
    roleLabel: 'Dosen Pembimbing & Penguji',
    username: 'dosen01',
    nama: 'Dr. Budi Santoso, M.Kom.',
    keterangan: 'Bimbingan berkala, ACC logbook, dan penilaian ujian skripsi'
  },
  {
    role: 'MAHASISWA',
    roleLabel: 'Mahasiswa Tingkat Akhir',
    username: 'mhs001',
    nama: 'Andi Pratama',
    keterangan: 'Pengajuan judul, upload revisi logbook, dan pendaftaran seminar/sidang'
  }
];

/**
 * Helper untuk menandatangani token JWT lokal (kompatibel penuh dengan SIM Skripsi & SSO)
 */
export function createSessionToken(user, expiresIn = '7d') {
  const payload = {
    sub: String(user.id || 1),
    username: user.username,
    nama: user.namaLengkap || user.nama,
    role: (user.role || 'MAHASISWA').toUpperCase(),
    scope: user.scope || {
      idUniversitas: '1',
      idFakultas: user.idFakultas ? String(user.idFakultas) : null,
      idProgramStudi: user.prodi_id ? String(user.prodi_id) : (user.idProgramStudi ? String(user.idProgramStudi) : null)
    },
    typ: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: JWT_ISSUER
  });
}

/**
 * Normalisasi objek user dari payload SSO sim-mhs-api
 */
function normalizeSsoUser(rawUser, usernameInput) {
  const roleObj = rawUser.role || {};
  const rawRoleCode = typeof roleObj === 'string' 
    ? roleObj 
    : (roleObj.kodeRole || rawUser.roleCode || rawUser.role || 'MAHASISWA');
  const roleCode = String(rawRoleCode).toUpperCase();

  const idProdi = rawUser.idProgramStudi 
    ? parseInt(rawUser.idProgramStudi, 10) 
    : (rawUser.scope?.idProgramStudi ? parseInt(rawUser.scope.idProgramStudi, 10) : null);

  const scope = rawUser.scope || {
    idUniversitas: String(rawUser.idUniversitas || '1'),
    idFakultas: rawUser.idFakultas ? String(rawUser.idFakultas) : null,
    idProgramStudi: idProdi ? String(idProdi) : null
  };

  return {
    id: String(rawUser.id || ''),
    username: rawUser.username || usernameInput,
    nama: rawUser.namaLengkap || rawUser.nama || usernameInput,
    namaLengkap: rawUser.namaLengkap || rawUser.nama || usernameInput,
    email: rawUser.email || null,
    role: roleCode,
    roleName: roleObj.namaRole || roleCode,
    roleDetail: typeof roleObj === 'object' ? roleObj : { kodeRole: roleCode, namaRole: roleCode },
    statusAktif: rawUser.statusAktif || 'Aktif',
    prodi_id: idProdi,
    scope
  };
}

/**
 * Endpoint POST /api/auth/login
 * Memvalidasi kredensial login pengguna melalui SSO sim-mhs-api.
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username / NIM / NIP dan kata sandi wajib diisi.'
      });
    }

    const trimmedUsername = String(username).trim();
    const trimmedPassword = String(password).trim();

    // 1. Hubungi Server SSO sim-mhs-api
    try {
      const ssoResponse = await fetch(`${SSO_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword
        })
      });

      const ssoData = await ssoResponse.json().catch(() => null);

      if (ssoResponse.ok && ssoData && ssoData.success && ssoData.data) {
        const rawUser = ssoData.data.user || {};
        const normalizedUser = normalizeSsoUser(rawUser, trimmedUsername);
        
        // Buat access token internal yang kompatibel dengan JWT_SECRET Backend SIM Skripsi
        const backendToken = createSessionToken(normalizedUser, '7d');
        const ssoAccessToken = ssoData.data.accessToken || ssoData.data.token;
        const refreshToken = ssoData.data.refreshToken || null;

        return res.status(200).json({
          success: true,
          message: 'Autentikasi SSO berhasil.',
          data: {
            tokenType: 'Bearer',
            token: backendToken,
            accessToken: backendToken,
            ssoAccessToken,
            refreshToken,
            expiresIn: '7d',
            user: normalizedUser
          }
        });
      }

      // Kredensial tidak valid dari SSO
      if (ssoResponse.status === 400 || ssoResponse.status === 401) {
        return res.status(401).json({
          success: false,
          message: (ssoData && ssoData.message) ? ssoData.message : 'Kredensial username atau kata sandi tidak cocok.'
        });
      }

      // Respons gagal lainnya dari server SSO
      return res.status(ssoResponse.status).json({
        success: false,
        message: (ssoData && ssoData.message) ? ssoData.message : `Gagal melakukan autentikasi ke server SSO (${ssoResponse.status}).`
      });

    } catch (networkError) {
      console.warn(`[SSO Auth] Gagal menghubungi layanan SSO di ${SSO_BASE_URL}:`, networkError.message);

      // Fallback offline untuk pengujian jika server SSO tidak dapat dijangkau
      const knownAccount = OFFICIAL_SSO_ACCOUNTS.find(
        acc => acc.username.toLowerCase() === trimmedUsername.toLowerCase()
      );

      if (knownAccount) {
        const fallbackUser = {
          id: '99',
          username: knownAccount.username,
          nama: knownAccount.nama,
          namaLengkap: knownAccount.nama,
          email: `${knownAccount.username}@kampus.ac.id`,
          role: knownAccount.role,
          roleName: knownAccount.roleLabel,
          roleDetail: {
            kodeRole: knownAccount.role,
            namaRole: knownAccount.roleLabel
          },
          statusAktif: 'Aktif',
          prodi_id: 1,
          scope: {
            idUniversitas: '1',
            idFakultas: '1',
            idProgramStudi: '1'
          }
        };

        const localToken = createSessionToken(fallbackUser, '7d');

        return res.status(200).json({
          success: true,
          message: 'Login SSO (Fallback Mode Offline) berhasil.',
          data: {
            tokenType: 'Bearer',
            token: localToken,
            accessToken: localToken,
            ssoAccessToken: null,
            refreshToken: null,
            expiresIn: '7d',
            user: fallbackUser
          }
        });
      }

      return res.status(503).json({
        success: false,
        message: 'Layanan SSO pusat (sim-mhs-api) tidak dapat dihubungi. Pastikan koneksi internet aktif.',
        error: networkError.message
      });
    }

  } catch (error) {
    console.error('[AuthController.login Uncaught Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memproses login SSO.',
      error: error.message
    });
  }
}

/**
 * Endpoint GET /api/auth/me
 * Mengembalikan informasi identitas pengguna aktif dari token JWT SSO.
 */
export async function me(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Sesi login tidak valid atau belum terautentikasi.'
      });
    }

    const authHeader = req.headers.authorization;
    let ssoDetail = null;

    // Ambil data profil live dari SSO jika memungkinkan
    if (authHeader) {
      try {
        const ssoRes = await fetch(`${SSO_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        if (ssoRes.ok) {
          const ssoData = await ssoRes.json();
          ssoDetail = ssoData.data || null;
        }
      } catch (err) {
        // Abaikan kegagalan tambahan, data token JWT sudah mencukupi
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Profil pengguna berhasil dimuat.',
      data: {
        id: req.user.id,
        username: req.user.nim_nip,
        nama: req.user.nama,
        role: req.user.role,
        prodi_id: req.user.prodi_id,
        scope: req.user.scope,
        detail: ssoDetail
      }
    });
  } catch (error) {
    console.error('[AuthController.me Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat profil pengguna.',
      error: error.message
    });
  }
}

/**
 * Endpoint POST /api/auth/refresh
 * Meneruskan permintaan refresh token ke SSO sim-mhs-api.
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken: rToken } = req.body;

    if (!rToken) {
      return res.status(400).json({
        success: false,
        message: 'Parameter refreshToken wajib disertakan.'
      });
    }

    const ssoRes = await fetch(`${SSO_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refreshToken: rToken })
    });

    const ssoData = await ssoRes.json().catch(() => null);

    return res.status(ssoRes.status).json(ssoData || {
      success: false,
      message: 'Gagal memperbarui token dari SSO.'
    });

  } catch (error) {
    console.error('[AuthController.refreshToken Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memperbarui token SSO.',
      error: error.message
    });
  }
}

/**
 * Endpoint GET /api/auth/accounts
 * Mengembalikan informasi akun uji coba resmi dari sim-mhs-api untuk 5 role.
 */
export function getTestAccounts(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Daftar akun SSO resmi untuk pengujian 5 role SIM Skripsi.',
    data: {
      ssoUrl: SSO_BASE_URL,
      accounts: OFFICIAL_SSO_ACCOUNTS
    }
  });
}
