import dotenv from 'dotenv';
import app from './src/app.js';
import { testConnection } from './src/config/database.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('='.repeat(55));
  console.log('🚀 Memulai Server SIM Skripsi Backend API...');
  console.log('='.repeat(55));

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn('⚠️ Peringatan: Gagal terhubung ke MySQL! Pastikan MySQL Laragon aktif.');
  }

  app.listen(PORT, () => {
    console.log(`✅ Server berjalan di http://localhost:${PORT}`);
    console.log(`📡 Health Check : http://localhost:${PORT}/health`);
    console.log(`📚 API Base URL : http://localhost:${PORT}/api`);
    console.log('='.repeat(55));
  });
}

startServer();
