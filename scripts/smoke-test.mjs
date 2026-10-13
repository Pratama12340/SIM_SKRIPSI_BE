/**
 * Smoke test endpoint SIM Skripsi (tanpa framework test eksternal).
 *
 * Prasyarat:
 *   1. Server berjalan : npm run dev   (atau npm start)
 *   2. Database sudah  : npm run migrate:deploy && npm run seed
 *
 * Jalankan:
 *   node scripts/smoke-test.mjs                 -> http://localhost:5000
 *   node scripts/smoke-test.mjs http://localhost:5100
 *
 * Skrip ini memakai token JWT dummy (sama dengan generate_token.js) dan
 * bersifat aman dijalankan berulang kali (data uji dibuat lalu dihapus lagi).
 */
import { createToken } from '../generate_token.js';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const tokens = {
  mhs: createToken({ id: 5, username: '20260001', nama: 'Contoh Mahasiswa', role: 'MAHASISWA', prodi_id: 1 }),
  dosen: createToken({ id: 10, username: '198501012010121001', nama: 'Dr. Budi Santoso, M.Kom.', role: 'DOSEN', prodi_id: 1 }),
  kaprodi: createToken({ id: 2, username: 'kaprodi.ti', nama: 'Ketua Prodi Teknik Informatika', role: 'KAPRODI', prodi_id: 1 })
};

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  [OK]   ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  [GAGAL] ${name} ${detail}`);
  }
}

async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // biarkan fetch menentukan multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { _raw: text };
    }
    return { status: res.status, data };
  } catch (error) {
    return { status: 0, data: { success: false, message: error.message } };
  }
}

function pdfForm(fieldName, filename) {
  const form = new FormData();
  form.append(fieldName, new Blob(['%PDF-1.4 dummy'], { type: 'application/pdf' }), filename);
  return form;
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  console.log(`Smoke test SIM Skripsi -> ${BASE}`);

  // ---------------------------------------------------------------
  section('Kesehatan & Autentikasi');
  {
    const r = await req('GET', '/health');
    check('GET /health -> 200 & status OK', r.status === 200 && r.data?.status === 'OK');

    const r2 = await req('GET', '/api/pengajuan');
    check('GET /api/pengajuan tanpa token -> 401', r2.status === 401);

    const r3 = await req('GET', '/api/pengajuan', { token: 'token-salah' });
    check('GET /api/pengajuan token rusak -> 403', r3.status === 403);
  }

  // ---------------------------------------------------------------
  section('Pengajuan Skripsi');
  let submittedId = null;
  {
    const r = await req('GET', '/api/pengajuan', { token: tokens.mhs });
    const rows = r.data?.data || [];
    check('GET /api/pengajuan (mhs) -> 200 & hanya miliknya', r.status === 200 && rows.every((x) => x.nim === '20260001'));
    check('kunci JSON snake_case (nama_mahasiswa)', rows.length > 0 && 'nama_mahasiswa' in rows[0]);
    check('total_bimbingan berupa number (bukan BigInt)', rows.length > 0 && typeof rows[0].total_bimbingan === 'number');

    const r2 = await req('GET', '/api/pengajuan/1', { token: tokens.dosen });
    check('GET /api/pengajuan/1 -> 200 + logbooks & sidangs', r2.status === 200 && Array.isArray(r2.data?.data?.logbooks) && Array.isArray(r2.data?.data?.sidangs));

    const r3 = await req('GET', '/api/pengajuan/abc', { token: tokens.dosen });
    check('GET /api/pengajuan/abc -> 404', r3.status === 404);

    const r4 = await req('GET', '/api/pengajuan/999999', { token: tokens.dosen });
    check('GET /api/pengajuan/999999 -> 404', r4.status === 404);

    // Submit draft baru (multipart + file PDF) - status draft agar bisa dihapus mahasiswa
    const form = pdfForm('file_proposal', 'proposal-uji.pdf');
    form.append('judul', 'Judul Uji Coba Smoke Test');
    form.append('bidang_kajian', 'Testing');
    form.append('status', 'draft');
    const r5 = await req('POST', '/api/pengajuan/submit', { token: tokens.mhs, form });
    submittedId = r5.data?.data?.id;
    check('POST /api/pengajuan/submit -> 201 & file tersimpan', r5.status === 201 && typeof submittedId === 'number' && String(r5.data?.data?.file_proposal || '').endsWith('.pdf'));

    // Submit tanpa judul -> 400
    const r6 = await req('POST', '/api/pengajuan/submit', { token: tokens.mhs, body: { bidang_kajian: 'X' } });
    check('POST /api/pengajuan/submit tanpa judul -> 400', r6.status === 400);

    // Update status oleh dosen
    const r7 = await req('PUT', '/api/pengajuan/1/status', { token: tokens.dosen, body: { status: 'disetujui' } });
    check('PUT /api/pengajuan/1/status (dosen) -> 200', r7.status === 200);

    const r8 = await req('PUT', '/api/pengajuan/1/status', { token: tokens.dosen, body: { status: 'ngasal' } });
    check('PUT status nilai tidak valid -> 400', r8.status === 400);

    const r9 = await req('PUT', '/api/pengajuan/1/status', { token: tokens.mhs, body: { status: 'disetujui' } });
    check('PUT status oleh mahasiswa -> 403 (RBAC)', r9.status === 403);

    // Hapus draft milik sendiri (data uji dibuat di atas)
    if (submittedId) {
      const r10 = await req('DELETE', `/api/pengajuan/${submittedId}`, { token: tokens.mhs });
      check('DELETE /api/pengajuan/:id (draft sendiri) -> 200', r10.status === 200);
    } else {
      check('DELETE /api/pengajuan/:id (draft sendiri) -> 200', false, '(id submit tidak didapat)');
    }

    const r11 = await req('DELETE', '/api/pengajuan/1', { token: tokens.mhs });
    check('DELETE pengajuan non-draft oleh mhs -> 400', r11.status === 400);
  }

  // ---------------------------------------------------------------
  section('Logbook Bimbingan');
  let logbookId = null;
  {
    const r = await req('GET', '/api/bimbingan/1', { token: tokens.dosen });
    const rows = r.data?.data || [];
    check('GET /api/bimbingan/1 -> 200 + kolom join (judul)', r.status === 200 && rows.length >= 2 && 'judul' in rows[0] && 'nama_mahasiswa' in rows[0]);

    // Tambah bimbingan (validasi status & field)
    const r2 = await req('POST', '/api/bimbingan/tambah', { token: tokens.mhs, body: { skripsi_id: 2, dosen_nip: '198501012010121001', tanggal_bimbingan: '2026-10-02', catatan_mahasiswa: 'X' } });
    check('POST /api/bimbingan/tambah skripsi non-disetujui -> 400', r2.status === 400);

    const form = pdfForm('file_revisi', 'revisi-uji.pdf');
    form.append('skripsi_id', '1');
    form.append('dosen_nip', '198501012010121001');
    form.append('tanggal_bimbingan', '2026-10-02');
    form.append('catatan_mahasiswa', 'Uji tambah bimbingan via smoke test');
    const r3 = await req('POST', '/api/bimbingan/tambah', { token: tokens.mhs, form });
    logbookId = r3.data?.data?.id;
    check('POST /api/bimbingan/tambah -> 201', r3.status === 201 && typeof logbookId === 'number');

    // ACC oleh dosen
    const r4 = await req('PUT', `/api/bimbingan/${logbookId || 1}/acc`, { token: tokens.dosen, body: { status_acc: 'acc', catatan_dosen: 'Baik, lanjutkan.' } });
    check('PUT /api/bimbingan/:id/acc (dosen) -> 200', r4.status === 200);

    const r5 = await req('PUT', `/api/bimbingan/${logbookId || 1}/acc`, { token: tokens.dosen, body: { status_acc: 'asdf' } });
    check('PUT acc status_acc tidak valid -> 400', r5.status === 400);

    // Hapus logbook yang sudah ACC oleh mahasiswa -> 400 (harus pending)
    if (logbookId) {
      const r6 = await req('DELETE', `/api/bimbingan/${logbookId}`, { token: tokens.mhs });
      check('DELETE logbook sudah direspon (mhs) -> 400', r6.status === 400);

      // Bersihkan: admin boleh hapus
      const r7 = await req('DELETE', `/api/bimbingan/${logbookId}`, { token: tokens.kaprodi });
      check('DELETE logbook oleh KAPRODI -> 200 (bersih-bersih)', r7.status === 200);
    }
  }

  // ---------------------------------------------------------------
  section('Seminar & Sidang');
  {
    const r = await req('GET', '/api/seminar/jadwal');
    const rows = r.data?.data || [];
    check('GET /api/seminar/jadwal publik -> 200 + join kolom mhs', r.status === 200 && rows.length >= 2 && 'nama_mahasiswa' in rows[0]);

    const r2 = await req('POST', '/api/seminar/daftar', { token: tokens.mhs, body: { skripsi_id: 1, jenis_sidang: 'sempro' } });
    check('POST daftar sempro ganda -> 400 (guard ganda)', r2.status === 400 && String(r2.data?.message || '').includes('sudah memiliki pendaftaran'));

    const r3 = await req('POST', '/api/seminar/daftar', { token: tokens.mhs, body: { skripsi_id: 3, jenis_sidang: 'sempro' } });
    check('POST daftar skripsi bukan milik/non-disetujui -> 400/403/404', [400, 403, 404].includes(r3.status));

    const r4 = await req('POST', '/api/seminar/daftar', { token: tokens.mhs, body: { skripsi_id: 1, jenis_sidang: 'semhas' } });
    check('POST daftar semhas -> 201 (atau 400 duplikat jika sudah pernah)', r4.status === 201 || (r4.status === 400 && String(r4.data?.message || '').includes('sudah memiliki pendaftaran')));

    const r5 = await req('PUT', '/api/seminar/1/jadwal', { token: tokens.dosen, body: { jadwal_sidang: '2026-10-26T10:00:00+07:00', ruangan: 'Ruang Uji Coba 2' } });
    check('PUT /api/seminar/1/jadwal (dosen) -> 200', r5.status === 200);

    const r6 = await req('GET', '/api/seminar/jadwal?skripsi_id=1', { token: tokens.dosen });
    const sidang1 = (r6.data?.data || []).find((x) => x.id === 1);
    check('jadwal terkonversi benar (10:00+07 == 03:00Z)', Boolean(sidang1) && sidang1.jadwal_sidang === '2026-10-26T03:00:00.000Z', `didapat: ${sidang1?.jadwal_sidang}`);

    const r7 = await req('PUT', '/api/seminar/1/jadwal', { token: tokens.dosen, body: { status: 'gagal' } });
    check('PUT jadwal status tidak valid -> 400', r7.status === 400);

    const r8 = await req('PUT', '/api/seminar/1/jadwal', { token: tokens.mhs, body: { ruangan: 'X' } });
    check('PUT jadwal oleh mahasiswa -> 403 (RBAC)', r8.status === 403);

    const r9 = await req('GET', '/api/seminar/jadwal?jenis_sidang=ngasal', { token: tokens.dosen });
    check('GET jadwal filter jenis_sidang ngasal -> 200 kosong', r9.status === 200 && r9.data?.total === 0);
  }

  // ---------------------------------------------------------------
  section('Nilai Sidang');
  {
    // Tes nilai memakai pendaftaran id=2 (sidang_akhir milik seed) agar tidak
    // mengubah status pendaftaran id=1 yang dipakai tes guard ganda di atas.
    const r = await req('GET', '/api/nilai/2', { token: tokens.dosen });
    check('GET /api/nilai/2 -> 200 & nilai_akhir string (kontrak DECIMAL)', r.status === 200 && r.data?.data?.nilai_akhir === '88.50', `didapat: ${JSON.stringify(r.data?.data?.nilai_akhir)}`);

    const r2 = await req('PUT', '/api/nilai/2', { token: tokens.dosen, body: { nilai_akhir: 75.5 } });
    check('PUT nilai 75.5 -> 200 status lulus', r2.status === 200 && r2.data?.data?.status === 'lulus');

    const r3 = await req('PUT', '/api/nilai/2', { token: tokens.dosen, body: { nilai_akhir: 45 } });
    check('PUT nilai 45 -> 200 status revisi', r3.status === 200 && r3.data?.data?.status === 'revisi');

    const r4 = await req('PUT', '/api/nilai/2', { token: tokens.dosen, body: { nilai_akhir: 150 } });
    check('PUT nilai 150 -> 400 (di luar 0-100)', r4.status === 400);

    const r5 = await req('PUT', '/api/nilai/2', { token: tokens.dosen, body: { nilai_akhir: 80, status: 'gagal' } });
    check('PUT status di luar CHECK -> 400', r5.status === 400);

    const r6 = await req('PUT', '/api/nilai/2', { token: tokens.mhs, body: { nilai_akhir: 90 } });
    check('PUT nilai oleh mahasiswa -> 403 (RBAC)', r6.status === 403);

    const r7 = await req('GET', '/api/nilai/999999', { token: tokens.dosen });
    check('GET /api/nilai/999999 -> 404', r7.status === 404);

    // Kembalikan nilai akhir seed (lulus, 88.5) agar tes bisa diulang
    await req('PUT', '/api/nilai/2', { token: tokens.dosen, body: { nilai_akhir: 88.5, status: 'lulus' } });
  }

  // ---------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log(`Hasil: ${pass} OK, ${fail} GAGAL`);
  if (fail > 0) {
    console.log('Gagal:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(60));

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Smoke test error:', error);
  process.exit(1);
});
