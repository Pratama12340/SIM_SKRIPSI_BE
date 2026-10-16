import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import pengajuanRoutes from './routes/pengajuanRoutes.js';
import bimbinganRoutes from './routes/bimbinganRoutes.js';
import seminarRoutes from './routes/seminarRoutes.js';
import nilaiRoutes from './routes/nilaiRoutes.js';
import masterRoutes from './routes/masterRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Akses publik ke file unggahan (PDF proposal & skripsi)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Root & Health Check Endpoint
const healthPayload = () => ({
  status: 'OK',
  service: 'SIM Skripsi Backend API',
  version: '1.0.0',
  time: new Date().toISOString()
});

app.get('/', (req, res) => res.json(healthPayload()));
app.get('/api', (req, res) => res.json(healthPayload()));
app.get('/health', (req, res) => res.json(healthPayload()));
app.get('/api/health', (req, res) => res.json(healthPayload()));

// Registrasi Route API Utama
app.use('/api/auth', authRoutes);
app.use('/api/pengajuan', pengajuanRoutes);
app.use('/api/bimbingan', bimbinganRoutes);
app.use('/api/seminar', seminarRoutes);
app.use('/api/nilai', nilaiRoutes);
app.use('/api/master', masterRoutes);


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
