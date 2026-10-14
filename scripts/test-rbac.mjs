import express from 'express';
import http from 'http';
import { verifyToken, requireRole } from '../src/middlewares/authMiddleware.js';

const app = express();
app.use(express.json());

// Dummy protected routes for testing RBAC
app.get('/test/admin-only', verifyToken, requireRole('ADMIN'), (req, res) => res.json({ success: true, message: 'Admin OK' }));
app.get('/test/kaprodi-only', verifyToken, requireRole('KAPRODI'), (req, res) => res.json({ success: true, message: 'Kaprodi OK' }));
app.get('/test/dekanat-only', verifyToken, requireRole('DEKANAT'), (req, res) => res.json({ success: true, message: 'Dekanat OK' }));
app.get('/test/dosen-only', verifyToken, requireRole('DOSEN'), (req, res) => res.json({ success: true, message: 'Dosen OK' }));
app.get('/test/mahasiswa-only', verifyToken, requireRole('MAHASISWA'), (req, res) => res.json({ success: true, message: 'Mahasiswa OK' }));

const server = http.createServer(app);
const PORT = 5097;

server.listen(PORT, async () => {
  console.log(`\n=======================================================`);
  console.log(`Pengujian Role-Based Access Control (RBAC) Port ${PORT}...`);
  console.log(`=======================================================\n`);

  try {
    // Login to get tokens for the 5 roles
    async function getToken(u, p) {
      const res = await fetch('http://localhost:5098/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();
      return data.data.token;
    }

    // Since port 5098 is not listening right now, we can spin up backend or use createSessionToken directly
    const { createSessionToken } = await import('../src/controllers/authController.js');

    const adminToken = createSessionToken({ id: 1, username: 'admin', role: 'ADMIN' });
    const admProdiToken = createSessionToken({ id: 2, username: 'adm_prodi_ti', role: 'ADMIN_PRODI' });
    const kaprodiToken = createSessionToken({ id: 3, username: 'kaprodi_ti', role: 'KAPRODI' });
    const admDekanatToken = createSessionToken({ id: 4, username: 'adm_dekanat', role: 'ADMIN_DEKANAT' });
    const dosenToken = createSessionToken({ id: 5, username: 'dosen01', role: 'DOSEN' });
    const mhsToken = createSessionToken({ id: 6, username: 'mhs001', role: 'MAHASISWA' });

    async function checkRoute(endpoint, token, expectedStatus) {
      const res = await fetch(`http://localhost:${PORT}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status !== expectedStatus) {
        throw new Error(`Expected ${expectedStatus} on ${endpoint}, got ${res.status}`);
      }
      return res.status;
    }

    // 1. ADMIN should access everything
    await checkRoute('/test/admin-only', adminToken, 200);
    await checkRoute('/test/kaprodi-only', adminToken, 200);
    await checkRoute('/test/dekanat-only', adminToken, 200);
    await checkRoute('/test/dosen-only', adminToken, 200);
    await checkRoute('/test/mahasiswa-only', adminToken, 200);
    console.log('[PASS] Role ADMIN memiliki akses penuh ke seluruh rute (200 OK)');

    // 2. ADMIN_PRODI should access /test/kaprodi-only (alias)
    await checkRoute('/test/kaprodi-only', admProdiToken, 200);
    await checkRoute('/test/mahasiswa-only', admProdiToken, 403);
    console.log('[PASS] Role ADMIN_PRODI diizinkan pada guard KAPRODI via alias (200 OK) & ditolak pada MAHASISWA (403)');

    // 3. KAPRODI should access /test/kaprodi-only
    await checkRoute('/test/kaprodi-only', kaprodiToken, 200);
    await checkRoute('/test/dosen-only', kaprodiToken, 403);
    console.log('[PASS] Role KAPRODI diizinkan pada guard KAPRODI (200 OK) & ditolak pada DOSEN (403)');

    // 4. ADMIN_DEKANAT should access /test/dekanat-only (alias)
    await checkRoute('/test/dekanat-only', admDekanatToken, 200);
    await checkRoute('/test/mahasiswa-only', admDekanatToken, 403);
    console.log('[PASS] Role ADMIN_DEKANAT diizinkan pada guard DEKANAT via alias (200 OK) & ditolak pada MAHASISWA (403)');

    // 5. DOSEN should access /test/dosen-only
    await checkRoute('/test/dosen-only', dosenToken, 200);
    await checkRoute('/test/mahasiswa-only', dosenToken, 403);
    console.log('[PASS] Role DOSEN diizinkan pada guard DOSEN (200 OK) & ditolak pada MAHASISWA (403)');

    // 6. MAHASISWA should access /test/mahasiswa-only
    await checkRoute('/test/mahasiswa-only', mhsToken, 200);
    await checkRoute('/test/dosen-only', mhsToken, 403);
    console.log('[PASS] Role MAHASISWA diizinkan pada guard MAHASISWA (200 OK) & ditolak pada DOSEN (403)');

    console.log(`\n=======================================================`);
    console.log(`SEMUA GUARD RBAC UNTUK 5 ROLE BERJALAN SEMPURNA!`);
    console.log(`=======================================================\n`);

  } catch (err) {
    console.error('[FAIL] RBAC test error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
});
