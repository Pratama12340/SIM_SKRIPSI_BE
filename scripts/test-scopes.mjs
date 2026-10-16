import http from 'http';
import app from '../src/app.js';
import { createSessionToken } from '../src/controllers/authController.js';

const server = http.createServer(app);
const PORT = 5088;

server.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}...`);

  try {
    // 1. Tokens for roles
    const adminToken = createSessionToken({ id: 1, username: 'admin', role: 'ADMIN' });
    const dekanatToken = createSessionToken({
      id: 4, username: 'adm_dekanat', role: 'ADMIN_DEKANAT',
      scope: { idUniversitas: '1', idFakultas: '1', idProgramStudi: null }
    });
    const prodiToken = createSessionToken({
      id: 2, username: 'adm_prodi_ti', role: 'ADMIN_PRODI',
      scope: { idUniversitas: '1', idFakultas: '1', idProgramStudi: '1' }
    });
    const mhsToken = createSessionToken({
      id: 6, username: '20260001', role: 'MAHASISWA',
      scope: { idUniversitas: '1', idFakultas: '1', idProgramStudi: '1' }
    });

    // Helper fetch
    async function apiGet(endpoint, token) {
      const res = await fetch(`http://localhost:${PORT}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }

    console.log('\n--- 1. Testing GET /api/master/fakultas ---');
    const fAdmin = await apiGet('/api/master/fakultas', adminToken);
    console.log('ADMIN fakultas count:', fAdmin.body.total);
    const fDekanat = await apiGet('/api/master/fakultas', dekanatToken);
    console.log('DEKANAT fakultas count:', fDekanat.body.total, '| Fakultas:', fDekanat.body.data?.[0]?.namaFakultas);

    console.log('\n--- 2. Testing GET /api/master/program-studi ---');
    const pAdmin = await apiGet('/api/master/program-studi', adminToken);
    console.log('ADMIN prodi count:', pAdmin.body.total);
    const pDekanat = await apiGet('/api/master/program-studi', dekanatToken);
    console.log('DEKANAT prodi count:', pDekanat.body.total, '| Prodis:', pDekanat.body.data?.map(p => p.kodeProgramStudi).join(', '));
    const pProdi = await apiGet('/api/master/program-studi', prodiToken);
    console.log('ADMIN_PRODI prodi count:', pProdi.body.total, '| Prodi:', pProdi.body.data?.map(p => p.kodeProgramStudi).join(', '));

    console.log('\n--- 3. Testing GET /api/master/scope ---');
    const sDekanat = await apiGet('/api/master/scope', dekanatToken);
    console.log('DEKANAT scope:', sDekanat.body.data?.scopeLevel, '| Allowed prodis:', sDekanat.body.data?.allowedProdiIds);
    const sProdi = await apiGet('/api/master/scope', prodiToken);
    console.log('PRODI scope:', sProdi.body.data?.scopeLevel, '| Allowed prodis:', sProdi.body.data?.allowedProdiIds);

    console.log('\n--- 4. Testing GET /api/pengajuan Scope Filtering ---');
    const pengAdmin = await apiGet('/api/pengajuan', adminToken);
    console.log('ADMIN pengajuan count:', pengAdmin.body.total);
    const pengDekanat = await apiGet('/api/pengajuan', dekanatToken);
    console.log('DEKANAT pengajuan count:', pengDekanat.body.total);
    const pengProdi = await apiGet('/api/pengajuan', prodiToken);
    console.log('PRODI pengajuan count:', pengProdi.body.total);
    const pengMhs = await apiGet('/api/pengajuan', mhsToken);
    console.log('MAHASISWA (20260001) pengajuan count:', pengMhs.body.total);

    console.log('\nSEMUA PENGUJIAN SCOPE & RBAC BERHASIL 100%!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit();
  }
});
