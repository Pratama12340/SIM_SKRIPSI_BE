import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET || 'rahasia_bersama_sim_mahasiswa_sso';

function createToken(user) {
  const payload = {
    sub: String(user.id || 1),
    username: user.username || user.nim_nip,
    nama: user.nama,
    role: (user.role || 'MAHASISWA').toUpperCase(),
    scope: {
      idUniversitas: "1",
      idFakultas: "1",
      idProgramStudi: String(user.prodi_id || 1)
    },
    typ: "access"
  };

  return jwt.sign(payload, secret, {
    expiresIn: '7d',
    issuer: 'sim-mhs-api'
  });
}

// Token Mahasiswa Dummy
const mhsToken = createToken({
  id: 5,
  username: '20260001',
  nama: 'Contoh Mahasiswa',
  role: 'MAHASISWA',
  prodi_id: 1
});

// Token Dosen Dummy
const dosenToken = createToken({
  id: 10,
  username: '198501012010121001',
  nama: 'Dr. Budi Santoso, M.Kom.',
  role: 'DOSEN',
  prodi_id: 1
});

// Token Kaprodi Dummy
const kaprodiToken = createToken({
  id: 2,
  username: 'kaprodi.ti',
  nama: 'Ketua Prodi Teknik Informatika',
  role: 'KAPRODI',
  prodi_id: 1
});

console.log('='.repeat(65));
console.log('🔑 JWT TOKEN GENERATOR UNTUK TESTING & DEVELOPMENT');
console.log('='.repeat(65));
console.log('\n[1] MAHASISWA (NIM: 20260001 - Contoh Mahasiswa):');
console.log(mhsToken);

console.log('\n[2] DOSEN (NIP: 198501012010121001 - Dr. Budi Santoso):');
console.log(dosenToken);

console.log('\n[3] KAPRODI (KAPRODI / ADMIN):');
console.log(kaprodiToken);
console.log('\n' + '='.repeat(65));
console.log('💡 Gunakan token di atas pada Header request HTTP:');
console.log('   Authorization: Bearer <TOKEN>');
console.log('='.repeat(65));
