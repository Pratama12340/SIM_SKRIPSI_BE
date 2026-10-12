import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import pengajuanRoutes from './routes/pengajuanRoutes.js';
import bimbinganRoutes from './routes/bimbinganRoutes.js';
import seminarRoutes from './routes/seminarRoutes.js';
import nilaiRoutes from './routes/nilaiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Akses publik ke file unggahan (PDF proposal & skripsi)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'SIM Skripsi Backend API',
    time: new Date().toISOString()
  });
});

// Registrasi Route API Utama
app.use('/api/pengajuan', pengajuanRoutes);
app.use('/api/bimbingan', bimbinganRoutes);
app.use('/api/seminar', seminarRoutes);
app.use('/api/nilai', nilaiRoutes);

// Handler Route 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal pada server',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;
