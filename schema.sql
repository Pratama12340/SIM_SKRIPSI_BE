
-- ============================================
-- Skema Basis Data SIM Skripsi
-- Database: db_sim_skripsi
-- PostgreSQL / Neon
--
-- CATATAN: Sumber kebenaran skema saat ini adalah
-- prisma/schema.prisma + prisma/migrations/0_init/migration.sql.
-- File ini dipertahankan sebagai referensi DDL manual dan
-- isinya identik dengan migrasi Prisma tersebut.
-- ============================================

BEGIN;

-- ============================================
-- 1. Tabel Pengajuan Skripsi
-- ============================================

CREATE TABLE IF NOT EXISTS pengajuan_skripsi (
    id SERIAL PRIMARY KEY,
    nim VARCHAR(20) NOT NULL,
    nama_mahasiswa VARCHAR(100) NOT NULL,
    prodi_id INTEGER DEFAULT NULL,
    judul TEXT NOT NULL,
    bidang_kajian VARCHAR(100) DEFAULT NULL,
    abstrak TEXT DEFAULT NULL,
    file_proposal VARCHAR(255) DEFAULT NULL,
    dosen_pembimbing_1_nip VARCHAR(30) DEFAULT NULL,
    dosen_pembimbing_1_nama VARCHAR(100) DEFAULT NULL,
    dosen_pembimbing_2_nip VARCHAR(30) DEFAULT NULL,
    dosen_pembimbing_2_nama VARCHAR(100) DEFAULT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'diajukan', 'disetujui', 'ditolak')),

    catatan_verifikasi TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nim
    ON pengajuan_skripsi(nim);

CREATE INDEX IF NOT EXISTS idx_status
    ON pengajuan_skripsi(status);

CREATE INDEX IF NOT EXISTS idx_dosen1
    ON pengajuan_skripsi(dosen_pembimbing_1_nip);

CREATE INDEX IF NOT EXISTS idx_dosen2
    ON pengajuan_skripsi(dosen_pembimbing_2_nip);


-- ============================================
-- 2. Tabel Logbook Bimbingan
-- ============================================

CREATE TABLE IF NOT EXISTS logbook_bimbingan (
    id SERIAL PRIMARY KEY,
    skripsi_id INTEGER NOT NULL,
    nim VARCHAR(20) NOT NULL,
    dosen_nip VARCHAR(30) NOT NULL,
    dosen_nama VARCHAR(100) DEFAULT NULL,
    tanggal_bimbingan DATE NOT NULL,
    catatan_mahasiswa TEXT NOT NULL,
    catatan_dosen TEXT DEFAULT NULL,
    file_revisi VARCHAR(255) DEFAULT NULL,

    status_acc VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status_acc IN ('pending', 'revisi', 'acc')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_logbook_skripsi
        FOREIGN KEY (skripsi_id)
        REFERENCES pengajuan_skripsi(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skripsi
    ON logbook_bimbingan(skripsi_id);

CREATE INDEX IF NOT EXISTS idx_logbook_nim
    ON logbook_bimbingan(nim);

CREATE INDEX IF NOT EXISTS idx_logbook_dosen
    ON logbook_bimbingan(dosen_nip);


-- ============================================
-- 3. Tabel Pendaftaran Sidang & Seminar
-- ============================================

CREATE TABLE IF NOT EXISTS pendaftaran_sidang (
    id SERIAL PRIMARY KEY,
    skripsi_id INTEGER NOT NULL,

    jenis_sidang VARCHAR(20) NOT NULL
        CHECK (jenis_sidang IN ('sempro', 'semhas', 'sidang_akhir')),

    file_naskah VARCHAR(255) DEFAULT NULL,
    jadwal_sidang TIMESTAMPTZ DEFAULT NULL,
    ruangan VARCHAR(100) DEFAULT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'menunggu_jadwal'
        CHECK (status IN ('menunggu_jadwal', 'terjadwal', 'lulus', 'revisi')),

    nilai_akhir NUMERIC(5,2) DEFAULT NULL,
    catatan_sidang TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sidang_skripsi
        FOREIGN KEY (skripsi_id)
        REFERENCES pengajuan_skripsi(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skripsi_sidang
    ON pendaftaran_sidang(skripsi_id);

CREATE INDEX IF NOT EXISTS idx_status_sidang
    ON pendaftaran_sidang(status);


-- ============================================
-- 4. Function untuk memperbarui updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 5. Trigger updated_at untuk setiap tabel
-- ============================================

DROP TRIGGER IF EXISTS trg_pengajuan_skripsi_updated_at
    ON pengajuan_skripsi;

CREATE TRIGGER trg_pengajuan_skripsi_updated_at
BEFORE UPDATE ON pengajuan_skripsi
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_logbook_bimbingan_updated_at
    ON logbook_bimbingan;

CREATE TRIGGER trg_logbook_bimbingan_updated_at
BEFORE UPDATE ON logbook_bimbingan
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_pendaftaran_sidang_updated_at
    ON pendaftaran_sidang;

CREATE TRIGGER trg_pendaftaran_sidang_updated_at
BEFORE UPDATE ON pendaftaran_sidang
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
