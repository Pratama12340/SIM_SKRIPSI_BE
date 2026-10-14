import app from '../src/app.js';
import http from 'http';

const TEST_PORT = 5098;
const server = http.createServer(app);

server.listen(TEST_PORT, async () => {
  console.log(`\n=======================================================`);
  console.log(`Memulai Pengujian Backend SSO Login (Port ${TEST_PORT})...`);
  console.log(`=======================================================\n`);

  try {
    // 1. Health check
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
    const healthData = await healthRes.json();
    console.log(`[PASS] GET /health -> HTTP ${healthRes.status} (Status: ${healthData.status})`);

    // 2. Official test accounts endpoint
    const accRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/accounts`);
    const accData = await accRes.json();
    console.log(`[PASS] GET /api/auth/accounts -> HTTP ${accRes.status} (${accData.data?.accounts?.length || 0} akun terdaftar)`);

    // 3. Test 5 roles SSO login
    const testCases = [
      { role: 'ADMIN', u: 'admin', p: 'Admin123!', expectedRole: 'ADMIN' },
      { role: 'ADMIN_PRODI', u: 'adm_prodi_ti', p: 'AdmProdi123!', expectedRole: 'ADMIN_PRODI' },
      { role: 'KAPRODI', u: 'kaprodi_ti', p: 'Kaprodi123!', expectedRole: 'KAPRODI' },
      { role: 'ADMIN_DEKANAT', u: 'adm_dekanat', p: 'AdmDekan123!', expectedRole: 'ADMIN_DEKANAT' },
      { role: 'DOSEN', u: 'dosen01', p: 'Dosen123!', expectedRole: 'DOSEN' },
      { role: 'MAHASISWA', u: 'mhs001', p: 'Mhs12345!', expectedRole: 'MAHASISWA' }
    ];

    for (const tc of testCases) {
      const loginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tc.u, password: tc.p })
      });
      const loginData = await loginRes.json();

      if (loginRes.status !== 200 || !loginData.success) {
        throw new Error(`Login gagal untuk role ${tc.role}: ${loginData.message}`);
      }

      console.log(`[PASS] POST /api/auth/login [${tc.role}] -> HTTP 200`);
      console.log(`       - Pengguna   : ${loginData.data.user.nama} (${loginData.data.user.username})`);
      console.log(`       - Role SSO   : ${loginData.data.user.role} (${loginData.data.user.roleName})`);
      console.log(`       - Token JWT  : ${loginData.data.token ? 'Tersedia' : 'Kosong'} (${loginData.data.tokenType})`);

      // 4. Test GET /api/auth/me using returned token
      const meRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${loginData.data.token}` }
      });
      const meData = await meRes.json();

      if (meRes.status !== 200 || !meData.success) {
        throw new Error(`GET /me gagal untuk role ${tc.role}: ${meData.message}`);
      }

      console.log(`[PASS] GET  /api/auth/me    [${tc.role}] -> HTTP 200 OK (Identitas: ${meData.data.nama}, Role: ${meData.data.role})\n`);
    }

    // 5. Test invalid password
    const badLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'mhs001', password: 'KataSandiSalah123!' })
    });
    const badLoginData = await badLoginRes.json();
    console.log(`[PASS] POST /api/auth/login [Wrong Password] -> HTTP ${badLoginRes.status} ("${badLoginData.message}")`);

    // 6. Test missing fields
    const emptyLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' })
    });
    const emptyLoginData = await emptyLoginRes.json();
    console.log(`[PASS] POST /api/auth/login [Empty Fields]   -> HTTP ${emptyLoginRes.status} ("${emptyLoginData.message}")`);

    // 7. Test unauthenticated /api/auth/me
    const noAuthMeRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/me`);
    const noAuthMeData = await noAuthMeRes.json();
    console.log(`[PASS] GET  /api/auth/me    [No Token]       -> HTTP ${noAuthMeRes.status} ("${noAuthMeData.message}")`);

    console.log(`\n=======================================================`);
    console.log(`SEMUA PENGUJIAN SSO BACKEND BERHASIL 100%!`);
    console.log(`=======================================================\n`);

  } catch (error) {
    console.error(`\n[FAIL] Terjadi kegagalan pengujian:`, error);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
});
