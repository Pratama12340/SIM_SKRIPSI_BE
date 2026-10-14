import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pathToFileURL } from 'url';

dotenv.config();

const secret = process.env.JWT_SECRET || 'rahasia_bersama_sim_mahasiswa_sso';

export function createToken(user) {
  const payload = {
    sub: String(user.id || 1),
    username: user.username || user.nim_nip,
    nama: user.nama,
    role: (user.role || 'MAHASISWA').toUpperCase(),
    scope: {
      idUniversitas: "1",
      idFakultas: user.fakultas_id ? String(user.fakultas_id) : "1",
      idProgramStudi: user.prodi_id ? String(user.prodi_id) : "1"
    },
    typ: "access"
  };

  return jwt.sign(payload, secret, {
    expiresIn: '7d',
    issuer: 'sim-mhs-api'
  });
}

// Blok berikut hanya dijalankan ketika file dieksekusi langsung:
//   node generate_token.js
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const adminToken = createToken({
    id: 1,
    username: 'admin',
    nama: 'Administrator Sistem',
    role: 'ADMIN',
    prodi_id: null
  });

  const admProdiToken = createToken({
    id: 2,
    username: 'adm_prodi_ti',
    nama: 'Operator Prodi TI',
    role: 'ADMIN_PRODI',
    prodi_id: 1
  });

  const admDekanatToken = createToken({
    id: 13,
    username: 'adm_dekanat',
    nama: 'Staff Administrasi FTI',
    role: 'ADMIN_DEKANAT',
    prodi_id: null
  });

  const dosenToken = createToken({
    id: 10,
    username: '198501012010121001',
    nama: 'Dr. Budi Santoso, M.Kom.',
    role: 'DOSEN',
    prodi_id: 1
  });

  const mhsToken = createToken({
    id: 5,
    username: '20260001',
    nama: 'Contoh Mahasiswa',
    role: 'MAHASISWA',
    prodi_id: 1
  });

  console.log('='.repeat(65));
  console.log('JWT TOKEN GENERATOR SSO - 5 ROLE SIM SKRIPSI');
  console.log('='.repeat(65));
  console.log('\n[1] ADMIN (admin):');
  console.log(adminToken);

  console.log('\n[2] ADMIN PRODI (adm_prodi_ti):');
  console.log(admProdiToken);

  console.log('\n[3] ADMIN DEKANAT (adm_dekanat):');
  console.log(admDekanatToken);

  console.log('\n[4] DOSEN (dosen01):');
  console.log(dosenToken);

  console.log('\n[5] MAHASISWA (20260001):');
  console.log(mhsToken);

  console.log('\n' + '='.repeat(65));
  console.log('Gunakan token di atas pada Header request HTTP:');
  console.log('   Authorization: Bearer <TOKEN>');
  console.log('='.repeat(65));
}
