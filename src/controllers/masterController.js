import masterDataService from '../services/masterDataService.js';
import { sendError } from '../utils/apiHelpers.js';

/**
 * Endpoint GET /api/master/fakultas
 * Mengambil daftar Fakultas dari SSO sim-mhs-api dengan filter otomatis sesuai role.
 */
export async function getFakultas(req, res) {
  try {
    const { role, scope } = req.user;
    const allFakultas = await masterDataService.getFakultasList();

    const userFakultasId = scope?.idFakultas ? parseInt(scope.idFakultas, 10) : null;

    // Untuk role ADMIN_DEKANAT, utamakan atau batasi ke fakultas miliknya
    let result = allFakultas;
    if (role === 'ADMIN_DEKANAT' && userFakultasId) {
      result = allFakultas.filter(f => f.id === userFakultasId);
    }

    return res.json({
      success: true,
      total: result.length,
      data: result
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil data fakultas');
  }
}

/**
 * Endpoint GET /api/master/program-studi
 * Mengambil daftar Program Studi dari SSO sim-mhs-api sesuai cakupan scope (Fakultas / Prodi).
 */
export async function getProgramStudi(req, res) {
  try {
    const { role, scope, prodi_id } = req.user;
    const allProdi = await masterDataService.getProgramStudiList();

    const userFakultasId = scope?.idFakultas ? parseInt(scope.idFakultas, 10) : null;
    const userProdiId = prodi_id || (scope?.idProgramStudi ? parseInt(scope.idProgramStudi, 10) : null);

    let result = allProdi;

    // 1. Role ADMIN_PRODI & KAPRODI -> hanya boleh melihat prodi miliknya
    if ((role === 'ADMIN_PRODI' || role === 'KAPRODI') && userProdiId) {
      result = allProdi.filter(p => p.id === userProdiId);
    }
    // 2. Role ADMIN_DEKANAT -> hanya boleh melihat prodi di bawah fakultas miliknya
    else if (role === 'ADMIN_DEKANAT' && userFakultasId) {
      result = allProdi.filter(p => p.idFakultas === userFakultasId);
    }
    // 3. Role ADMIN / umum -> dapat memfilter via query ?fakultas_id=...
    else if (req.query.fakultas_id) {
      const fid = parseInt(req.query.fakultas_id, 10);
      result = allProdi.filter(p => p.idFakultas === fid);
    }

    return res.json({
      success: true,
      total: result.length,
      data: result
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil data program studi');
  }
}

/**
 * Endpoint GET /api/master/scope
 * Mengembalikan informasi scope aktif dari pengguna yang sedang login.
 */
export async function getScopeInfo(req, res) {
  try {
    const { role, scope, prodi_id } = req.user;
    const userFakultasId = scope?.idFakultas ? parseInt(scope.idFakultas, 10) : null;
    const userProdiId = prodi_id || (scope?.idProgramStudi ? parseInt(scope.idProgramStudi, 10) : null);

    let fakultas = null;
    let programStudi = null;
    let allowedProdiIds = null; // null = semua prodi (ADMIN)

    if (userFakultasId) {
      fakultas = await masterDataService.getFakultasById(userFakultasId);
      allowedProdiIds = await masterDataService.getProdiIdsByFakultas(userFakultasId);
    }

    if (userProdiId) {
      programStudi = await masterDataService.getProgramStudiById(userProdiId);
      if (role === 'ADMIN_PRODI' || role === 'KAPRODI') {
        allowedProdiIds = [userProdiId];
      }
    }

    return res.json({
      success: true,
      data: {
        role,
        scopeLevel: role === 'ADMIN' ? 'UNIVERSITAS' : (role === 'ADMIN_DEKANAT' ? 'FAKULTAS' : 'PROGRAM_STUDI'),
        fakultas,
        programStudi,
        allowedProdiIds
      }
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil profil scope pengguna');
  }
}

/**
 * Endpoint GET /api/master/mahasiswa
 * Mengambil daftar data mahasiswa dari SSO sim-mhs-api (terfilter scope).
 */
export async function getMahasiswa(req, res) {
  try {
    const { role, scope, prodi_id } = req.user;
    const userFakultasId = scope?.idFakultas ? parseInt(scope.idFakultas, 10) : null;
    const userProdiId = prodi_id || (scope?.idProgramStudi ? parseInt(scope.idProgramStudi, 10) : null);

    const options = {
      search: req.query.search || null
    };

    if (role === 'ADMIN_PRODI' || role === 'KAPRODI') {
      options.idProgramStudi = userProdiId;
    } else if (role === 'ADMIN_DEKANAT') {
      options.idFakultas = userFakultasId;
      if (req.query.prodi_id) {
        options.idProgramStudi = req.query.prodi_id;
      }
    } else if (role === 'ADMIN') {
      if (req.query.prodi_id) options.idProgramStudi = req.query.prodi_id;
      if (req.query.fakultas_id) options.idFakultas = req.query.fakultas_id;
    }

    const mahasiswaList = await masterDataService.getMahasiswaList(options);

    return res.json({
      success: true,
      total: mahasiswaList.length,
      data: mahasiswaList
    });
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil data mahasiswa');
  }
}

export default {
  getFakultas,
  getProgramStudi,
  getScopeInfo,
  getMahasiswa
};
