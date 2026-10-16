import dotenv from 'dotenv';
dotenv.config();

const SSO_BASE_URL = process.env.SIM_MHS_API_URL || 'https://sim-mhs-api.vercel.app/api/v1';

// In-memory cache
let cachedSsoToken = null;
let tokenExpiresAt = 0;

let cachedFakultas = null;
let fakultasCachedAt = 0;

let cachedProdi = null;
let prodiCachedAt = 0;

const CACHE_TTL = 10 * 60 * 1000; // 10 menit

/**
 * Mendapatkan System Access Token dari sim-mhs-api (menggunakan akun admin SSO).
 */
export async function getSystemToken() {
  if (cachedSsoToken && Date.now() < tokenExpiresAt) {
    return cachedSsoToken;
  }

  try {
    const res = await fetch(`${SSO_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: process.env.SSO_SERVICE_USERNAME || 'admin',
        password: process.env.SSO_SERVICE_PASSWORD || 'Admin123!'
      })
    });

    const data = await res.json().catch(() => null);
    const token = data?.data?.accessToken || data?.data?.token;

    if (!token) {
      throw new Error(data?.message || 'Gagal login service account ke SSO sim-mhs-api');
    }

    cachedSsoToken = token;
    tokenExpiresAt = Date.now() + (50 * 60 * 1000); // 50 menit
    return token;
  } catch (error) {
    console.error('[masterDataService] Gagal mendapatkan System Token SSO:', error.message);
    throw error;
  }
}

/**
 * Mengambil daftar seluruh Fakultas dari SSO sim-mhs-api.
 */
export async function getFakultasList(forceRefresh = false) {
  if (!forceRefresh && cachedFakultas && (Date.now() - fakultasCachedAt < CACHE_TTL)) {
    return cachedFakultas;
  }

  const token = await getSystemToken();
  const res = await fetch(`${SSO_BASE_URL}/fakultas`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json?.data)) {
    throw new Error(json?.message || 'Gagal mengambil data fakultas dari SSO');
  }

  cachedFakultas = json.data.map(f => ({
    id: parseInt(f.id, 10),
    idUniversitas: parseInt(f.idUniversitas || '1', 10),
    kodeFakultas: f.kodeFakultas,
    namaFakultas: f.namaFakultas,
    raw: f
  }));
  fakultasCachedAt = Date.now();

  return cachedFakultas;
}

/**
 * Mengambil daftar seluruh Program Studi dari SSO sim-mhs-api.
 */
export async function getProgramStudiList(forceRefresh = false) {
  if (!forceRefresh && cachedProdi && (Date.now() - prodiCachedAt < CACHE_TTL)) {
    return cachedProdi;
  }

  const token = await getSystemToken();
  const res = await fetch(`${SSO_BASE_URL}/program-studi`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json?.data)) {
    throw new Error(json?.message || 'Gagal mengambil data program studi dari SSO');
  }

  cachedProdi = json.data.map(p => ({
    id: parseInt(p.id, 10),
    idFakultas: parseInt(p.idFakultas, 10),
    kodeProgramStudi: p.kodeProgramStudi,
    namaProgramStudi: p.namaProgramStudi,
    jenjang: p.jenjang || 'S1',
    statusAktif: p.statusAktif || 'Aktif',
    namaFakultas: p.fakultas?.namaFakultas || null,
    kodeFakultas: p.fakultas?.kodeFakultas || null,
    raw: p
  }));
  prodiCachedAt = Date.now();

  return cachedProdi;
}

/**
 * Mengambil daftar ID program studi di bawah fakultas tertentu.
 * Contoh: Fakultas Teknik (id 1) -> [1, 2, 6] (TI, SI, ARS)
 */
export async function getProdiIdsByFakultas(idFakultas) {
  const prodiList = await getProgramStudiList();
  const fid = parseInt(idFakultas, 10);
  return prodiList.filter(p => p.idFakultas === fid).map(p => p.id);
}

/**
 * Mengambil detail satu Program Studi berdasarkan ID.
 */
export async function getProgramStudiById(idProdi) {
  const prodiList = await getProgramStudiList();
  const pid = parseInt(idProdi, 10);
  return prodiList.find(p => p.id === pid) || null;
}

/**
 * Mengambil detail satu Fakultas berdasarkan ID.
 */
export async function getFakultasById(idFakultas) {
  const fakList = await getFakultasList();
  const fid = parseInt(idFakultas, 10);
  return fakList.find(f => f.id === fid) || null;
}

/**
 * Mengambil daftar Mahasiswa dari SSO sim-mhs-api (terfilter scope).
 */
export async function getMahasiswaList(options = {}) {
  const token = await getSystemToken();
  const query = new URLSearchParams();

  if (options.idProgramStudi) query.set('idProgramStudi', options.idProgramStudi);
  if (options.idFakultas) query.set('idFakultas', options.idFakultas);
  if (options.search) query.set('search', options.search);

  const url = `${SSO_BASE_URL}/mahasiswa${query.toString() ? '?' + query.toString() : ''}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const json = await res.json().catch(() => null);
  return json?.data || [];
}

export default {
  getSystemToken,
  getFakultasList,
  getProgramStudiList,
  getProdiIdsByFakultas,
  getProgramStudiById,
  getFakultasById,
  getMahasiswaList
};
