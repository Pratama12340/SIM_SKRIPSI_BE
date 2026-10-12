-- Skema Basis Data SIM Skripsi
-- Database: db_sim_skripsi

CREATE DATABASE IF NOT EXISTS db_sim_skripsi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE db_sim_skripsi;

-- 1. Tabel Pengajuan Skripsi
CREATE TABLE IF NOT EXISTS pengajuan_skripsi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nim VARCHAR(20) NOT NULL,
  nama_mahasiswa VARCHAR(100) NOT NULL,
  prodi_id INT DEFAULT NULL,
  judul TEXT NOT NULL,
  bidang_kajian VARCHAR(100) DEFAULT NULL,
  abstrak TEXT DEFAULT NULL,
  file_proposal VARCHAR(255) DEFAULT NULL,
  dosen_pembimbing_1_nip VARCHAR(30) DEFAULT NULL,
  dosen_pembimbing_1_nama VARCHAR(100) DEFAULT NULL,
  dosen_pembimbing_2_nip VARCHAR(30) DEFAULT NULL,
  dosen_pembimbing_2_nama VARCHAR(100) DEFAULT NULL,
  status ENUM('draft', 'diajukan', 'disetujui', 'ditolak') DEFAULT 'draft',
  catatan_verifikasi TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nim (nim),
  INDEX idx_status (status),
  INDEX idx_dosen1 (dosen_pembimbing_1_nip),
  INDEX idx_dosen2 (dosen_pembimbing_2_nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Logbook Bimbingan
CREATE TABLE IF NOT EXISTS logbook_bimbingan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  skripsi_id INT NOT NULL,
  nim VARCHAR(20) NOT NULL,
  dosen_nip VARCHAR(30) NOT NULL,
  dosen_nama VARCHAR(100) DEFAULT NULL,
  tanggal_bimbingan DATE NOT NULL,
  catatan_mahasiswa TEXT NOT NULL,
  catatan_dosen TEXT DEFAULT NULL,
  file_revisi VARCHAR(255) DEFAULT NULL,
  status_acc ENUM('pending', 'revisi', 'acc') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (skripsi_id) REFERENCES pengajuan_skripsi(id) ON DELETE CASCADE,
  INDEX idx_skripsi (skripsi_id),
  INDEX idx_nim (nim),
  INDEX idx_dosen (dosen_nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Pendaftaran Sidang & Seminar
CREATE TABLE IF NOT EXISTS pendaftaran_sidang (
  id INT AUTO_INCREMENT PRIMARY KEY,
  skripsi_id INT NOT NULL,
  jenis_sidang ENUM('sempro', 'semhas', 'sidang_akhir') NOT NULL,
  file_naskah VARCHAR(255) DEFAULT NULL,
  jadwal_sidang DATETIME DEFAULT NULL,
  ruangan VARCHAR(100) DEFAULT NULL,
  status ENUM('menunggu_jadwal', 'terjadwal', 'lulus', 'revisi') DEFAULT 'menunggu_jadwal',
  nilai_akhir DECIMAL(5,2) DEFAULT NULL,
  catatan_sidang TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (skripsi_id) REFERENCES pengajuan_skripsi(id) ON DELETE CASCADE,
  INDEX idx_skripsi_sidang (skripsi_id),
  INDEX idx_status_sidang (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
