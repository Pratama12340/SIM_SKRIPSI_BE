import { Prisma } from '../generated/prisma/client.js';
import masterDataService from '../services/masterDataService.js';

/**
 * Membangun kondisi SQL Prisma untuk membatasi akses data sesuai Scope Pengguna:
 * - ADMIN: Dapat melihat semua data atau memfilter via query prodi_id / fakultas_id.
 * - ADMIN_DEKANAT: Otomatis dibatasi HANYA pada prodi-prodi di bawah fakultas miliknya (scope.idFakultas).
 * - ADMIN_PRODI & KAPRODI: Otomatis dibatasi HANYA pada prodi miliknya (scope.idProgramStudi).
 * - MAHASISWA: Otomatis dibatasi HANYA pada pengajuan miliknya (nim).
 * - DOSEN: Dibatasi pada skripsi bimbingannya atau prodi terkait.
 *
 * @param {object} user - Objek req.user
 * @param {object} options - Opsi kolom & parameter
 * @returns {Promise<Prisma.Sql>} Prisma SQL condition
 */
export async function buildScopeCondition(user, { prodiColumn = 'p.prodi_id', nimColumn = 'p.nim', requestedProdiId = null } = {}) {
  const { role, nim_nip, scope, prodi_id, fakultas_id } = user;

  const userFakultasId = fakultas_id || (scope?.idFakultas ? parseInt(scope.idFakultas, 10) : null);
  const userProdiId = prodi_id || (scope?.idProgramStudi ? parseInt(scope.idProgramStudi, 10) : null);

  // 1. MAHASISWA -> HANYA miliknya sendiri
  if (role === 'MAHASISWA') {
    return Prisma.sql`${Prisma.raw(nimColumn)} = ${nim_nip}`;
  }

  // 2. ADMIN_PRODI & KAPRODI -> HANYA prodinya sendiri
  if (role === 'ADMIN_PRODI' || role === 'KAPRODI') {
    if (!userProdiId) {
      return Prisma.sql`FALSE`;
    }
    return Prisma.sql`${Prisma.raw(prodiColumn)} = ${userProdiId}`;
  }

  // 3. ADMIN_DEKANAT -> HANYA prodi-prodi dalam fakultas miliknya
  if (role === 'ADMIN_DEKANAT') {
    if (!userFakultasId) {
      return Prisma.sql`FALSE`;
    }
    const prodiIds = await masterDataService.getProdiIdsByFakultas(userFakultasId);
    if (!prodiIds || prodiIds.length === 0) {
      return Prisma.sql`FALSE`;
    }

    // Jika dekanat memilih filter prodi tertentu pada UI
    if (requestedProdiId) {
      const targetProdi = Number(requestedProdiId);
      // Validasi: prodi yang diminta harus benar-benar ada di fakultasnya!
      if (!prodiIds.includes(targetProdi)) {
        return Prisma.sql`FALSE`;
      }
      return Prisma.sql`${Prisma.raw(prodiColumn)} = ${targetProdi}`;
    }

    // Default: tampilkan semua prodi dalam fakultas tersebut
    return Prisma.sql`${Prisma.raw(prodiColumn)} IN (${Prisma.join(prodiIds)})`;
  }

  // 4. DOSEN
  if (role === 'DOSEN') {
    if (requestedProdiId) {
      return Prisma.sql`${Prisma.raw(prodiColumn)} = ${Number(requestedProdiId)}`;
    }
    return Prisma.sql`TRUE`;
  }

  // 5. ADMIN (Universitas) -> Akses bebas ke seluruh data
  if (requestedProdiId) {
    return Prisma.sql`${Prisma.raw(prodiColumn)} = ${Number(requestedProdiId)}`;
  }

  return Prisma.sql`TRUE`;
}

/**
 * Validasi apakah seorang pengguna berhak mengakses / memodifikasi skripsi tertentu.
 */
export async function assertCanAccessSkripsi(user, skripsi) {
  const { role, nim_nip, scope, prodi_id, fakultas_id } = user;

  if (role === 'ADMIN') return true;

  if (role === 'MAHASISWA') {
    return skripsi.nim === nim_nip;
  }

  const userProdiId = prodi_id || (scope?.idProgramStudi ? parseInt(scope.idProgramStudi, 10) : null);
  if (role === 'ADMIN_PRODI' || role === 'KAPRODI') {
    return skripsi.prodi_id === userProdiId;
  }

  const userFakultasId = fakultas_id || (scope?.idFakultas ? parseInt(scope.idFakultas, 10) : null);
  if (role === 'ADMIN_DEKANAT') {
    if (!userFakultasId) return false;
    const prodiIds = await masterDataService.getProdiIdsByFakultas(userFakultasId);
    return prodiIds.includes(skripsi.prodi_id);
  }

  return true;
}

export default {
  buildScopeCondition,
  assertCanAccessSkripsi
};
