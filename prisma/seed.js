/**
 * Seed data dummy SIM Skripsi (PostgreSQL/Neon via Prisma Client).
 *
 * Sifat:
 * - Idempotent: data yang sudah ada dilewati (tidak diupdate, tidak dihapus),
 *   sehingga aman dijalankan berulang kali dan tidak menimpa data produksi.
 * - Tabel dosen / program_studi TIDAK dibuat di database ini karena datanya
 *   berasal dari layanan lain (sim-mhs-api / SSO). Kolom terkait pada tabel
 *   skripsi bersifat denormalisasi (VARCHAR) sehingga tidak perlu tabel referensi.
 * - NIM/NIP dummy sengaja disamakan dengan token dummy di generate_token.js
 *   supaya memudahkan pengujian endpoint.
 *
 * Jalankan dengan: npm run seed   (== npx prisma db seed)
 */
import prisma from '../src/config/database.js';

const DUMMY_DOSEN = {
  nip: '198501012010121001',
  nama: 'Dr. Budi Santoso, M.Kom.'
};

async function ensurePengajuan(data) {
  const existing = await prisma.pengajuanSkripsi.findFirst({
    where: { nim: data.nim, judul: data.judul }
  });

  if (existing) {
    console.log(`   [lewati] Pengajuan "${data.judul.slice(0, 40)}..." sudah ada (id=${existing.id})`);
    return existing;
  }

  const created = await prisma.pengajuanSkripsi.create({ data });
  console.log(`   [baru]   Pengajuan id=${created.id} | ${data.nim} | status=${created.status}`);
  return created;
}

async function ensureLogbook(data) {
  const existing = await prisma.logbookBimbingan.findFirst({
    where: {
      skripsiId: data.skripsiId,
      tanggalBimbingan: data.tanggalBimbingan,
      catatanMahasiswa: data.catatanMahasiswa
    }
  });

  if (existing) {
    console.log(`   [lewati] Logbook id=${existing.id} sudah ada`);
    return existing;
  }

  const created = await prisma.logbookBimbingan.create({ data });
  console.log(`   [baru]   Logbook id=${created.id} | ${created.tanggalBimbingan.toISOString().slice(0, 10)} | ${created.statusAcc}`);
  return created;
}

async function ensureSidang(data) {
  const existing = await prisma.pendaftaranSidang.findFirst({
    where: { skripsiId: data.skripsiId, jenisSidang: data.jenisSidang }
  });

  if (existing) {
    console.log(`   [lewati] Pendaftaran ${data.jenisSidang} id=${existing.id} sudah ada`);
    return existing;
  }

  const created = await prisma.pendaftaranSidang.create({ data });
  console.log(`   [baru]   Pendaftaran id=${created.id} | ${created.jenisSidang} | status=${created.status}`);
  return created;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Seed database SIM Skripsi (idempotent - tidak menimpa data produksi)');
  console.log('='.repeat(60));

  // ------------------------------------------------------------
  // 1. Pengajuan skripsi
  // ------------------------------------------------------------
  console.log('\n[1/4] Pengajuan skripsi');

  const skripsiDisetujui = await ensurePengajuan({
    nim: '20260001',
    namaMahasiswa: 'Contoh Mahasiswa',
    prodiId: 1,
    judul: 'Rancang Bangun Sistem Informasi Manajemen Skripsi Berbasis Web',
    bidangKajian: 'Sistem Informasi',
    abstrak:
      'Penelitian ini membahas rancang bangun sistem informasi manajemen skripsi ' +
      'berbasis web untuk mengelola pengajuan judul, bimbingan, dan sidang.',
    status: 'disetujui',
    dosenPembimbing1Nip: DUMMY_DOSEN.nip,
    dosenPembimbing1Nama: DUMMY_DOSEN.nama,
    catatanVerifikasi: 'Judul disetujui, silakan mulai bimbingan dengan pembimbing utama.'
  });

  await ensurePengajuan({
    nim: '20260002',
    namaMahasiswa: 'Mahasiswa Dummy Dua',
    prodiId: 1,
    judul: 'Penerapan Machine Learning untuk Prediksi Kelulusan Mahasiswa',
    bidangKajian: 'Kecerdasan Buatan',
    abstrak: 'Draf usulan judul - masih berstatus draft dan dapat diedit oleh mahasiswa.',
    status: 'draft'
  });

  await ensurePengajuan({
    nim: '20260003',
    namaMahasiswa: 'Mahasiswa Dummy Tiga',
    prodiId: 1,
    judul: 'Analisis Sentimen Ulasan Aplikasi E-Learning Berbahasa Indonesia',
    bidangKajian: 'Data Mining',
    abstrak: 'Usulan judul telah diajukan dan menunggu verifikasi dari program studi.',
    status: 'diajukan'
  });

  // ------------------------------------------------------------
  // 2. Logbook bimbingan (hanya untuk skripsi berstatus disetujui)
  // ------------------------------------------------------------
  console.log('\n[2/4] Logbook bimbingan');

  await ensureLogbook({
    skripsiId: skripsiDisetujui.id,
    nim: '20260001',
    dosenNip: DUMMY_DOSEN.nip,
    dosenNama: DUMMY_DOSEN.nama,
    tanggalBimbingan: new Date(Date.UTC(2026, 8, 10)),
    catatanMahasiswa: 'Konsultasi draf bab I dan rumusan masalah.',
    catatanDosen: 'Perbaiki rumusan masalah dan batas kajian, lalu submit ulang.',
    statusAcc: 'revisi'
  });

  await ensureLogbook({
    skripsiId: skripsiDisetujui.id,
    nim: '20260001',
    dosenNip: DUMMY_DOSEN.nip,
    dosenNama: DUMMY_DOSEN.nama,
    tanggalBimbingan: new Date(Date.UTC(2026, 8, 24)),
    catatanMahasiswa: 'Revisi bab I dan bab II sesuai arahan pembimbing.',
    catatanDosen: null,
    statusAcc: 'pending'
  });

  // ------------------------------------------------------------
  // 3. Pendaftaran sidang / seminar (hanya untuk skripsi disetujui)
  // ------------------------------------------------------------
  console.log('\n[3/4] Pendaftaran sidang & seminar');

  await ensureSidang({
    skripsiId: skripsiDisetujui.id,
    jenisSidang: 'sempro',
    fileNaskah: null,
    jadwalSidang: new Date('2026-10-25T09:00:00+07:00'),
    ruangan: 'Ruang Seminar 1',
    status: 'terjadwal',
    nilaiAkhir: null,
    catatanSidang: null
  });

  await ensureSidang({
    skripsiId: skripsiDisetujui.id,
    jenisSidang: 'sidang_akhir',
    fileNaskah: null,
    jadwalSidang: new Date('2026-11-20T09:00:00+07:00'),
    ruangan: 'Ruang Sidang 1',
    status: 'lulus',
    nilaiAkhir: 88.5,
    catatanSidang: 'Lulus dengan revisi minor.'
  });

  // ------------------------------------------------------------
  // 4. Ringkasan
  // ------------------------------------------------------------
  console.log('\n[4/4] Ringkasan');
  const [jumlahPengajuan, jumlahLogbook, jumlahSidang] = await Promise.all([
    prisma.pengajuanSkripsi.count(),
    prisma.logbookBimbingan.count(),
    prisma.pendaftaranSidang.count()
  ]);
  console.log(`   pengajuan_skripsi  : ${jumlahPengajuan} baris`);
  console.log(`   logbook_bimbingan  : ${jumlahLogbook} baris`);
  console.log(`   pendaftaran_sidang : ${jumlahSidang} baris`);
  console.log('\nSeed selesai.');
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
