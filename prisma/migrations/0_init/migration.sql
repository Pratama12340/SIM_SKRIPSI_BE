-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "pengajuan_skripsi" (
    "id" SERIAL NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "nama_mahasiswa" VARCHAR(100) NOT NULL,
    "prodi_id" INTEGER,
    "judul" TEXT NOT NULL,
    "bidang_kajian" VARCHAR(100),
    "abstrak" TEXT,
    "file_proposal" VARCHAR(255),
    "dosen_pembimbing_1_nip" VARCHAR(30),
    "dosen_pembimbing_1_nama" VARCHAR(100),
    "dosen_pembimbing_2_nip" VARCHAR(30),
    "dosen_pembimbing_2_nama" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "catatan_verifikasi" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengajuan_skripsi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logbook_bimbingan" (
    "id" SERIAL NOT NULL,
    "skripsi_id" INTEGER NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "dosen_nip" VARCHAR(30) NOT NULL,
    "dosen_nama" VARCHAR(100),
    "tanggal_bimbingan" DATE NOT NULL,
    "catatan_mahasiswa" TEXT NOT NULL,
    "catatan_dosen" TEXT,
    "file_revisi" VARCHAR(255),
    "status_acc" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logbook_bimbingan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendaftaran_sidang" (
    "id" SERIAL NOT NULL,
    "skripsi_id" INTEGER NOT NULL,
    "jenis_sidang" VARCHAR(20) NOT NULL,
    "file_naskah" VARCHAR(255),
    "jadwal_sidang" TIMESTAMPTZ,
    "ruangan" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'menunggu_jadwal',
    "nilai_akhir" DECIMAL(5,2),
    "catatan_sidang" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pendaftaran_sidang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_nim" ON "pengajuan_skripsi"("nim");

-- CreateIndex
CREATE INDEX "idx_status" ON "pengajuan_skripsi"("status");

-- CreateIndex
CREATE INDEX "idx_dosen1" ON "pengajuan_skripsi"("dosen_pembimbing_1_nip");

-- CreateIndex
CREATE INDEX "idx_dosen2" ON "pengajuan_skripsi"("dosen_pembimbing_2_nip");

-- CreateIndex
CREATE INDEX "idx_skripsi" ON "logbook_bimbingan"("skripsi_id");

-- CreateIndex
CREATE INDEX "idx_logbook_nim" ON "logbook_bimbingan"("nim");

-- CreateIndex
CREATE INDEX "idx_logbook_dosen" ON "logbook_bimbingan"("dosen_nip");

-- CreateIndex
CREATE INDEX "idx_skripsi_sidang" ON "pendaftaran_sidang"("skripsi_id");

-- CreateIndex
CREATE INDEX "idx_status_sidang" ON "pendaftaran_sidang"("status");

-- AddForeignKey
ALTER TABLE "logbook_bimbingan" ADD CONSTRAINT "fk_logbook_skripsi" FOREIGN KEY ("skripsi_id") REFERENCES "pengajuan_skripsi"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pendaftaran_sidang" ADD CONSTRAINT "fk_sidang_skripsi" FOREIGN KEY ("skripsi_id") REFERENCES "pengajuan_skripsi"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- ============================================
-- CHECK Constraints (nilai status)
-- Prisma tidak mengekspresikan CHECK di schema.prisma,
-- sehingga didefinisikan manual di migration ini.
-- ============================================

ALTER TABLE "pengajuan_skripsi" ADD CONSTRAINT "pengajuan_skripsi_status_check"
    CHECK (status IN ('draft', 'diajukan', 'disetujui', 'ditolak'));

ALTER TABLE "logbook_bimbingan" ADD CONSTRAINT "logbook_bimbingan_status_acc_check"
    CHECK (status_acc IN ('pending', 'revisi', 'acc'));

ALTER TABLE "pendaftaran_sidang" ADD CONSTRAINT "pendaftaran_sidang_jenis_sidang_check"
    CHECK (jenis_sidang IN ('sempro', 'semhas', 'sidang_akhir'));

ALTER TABLE "pendaftaran_sidang" ADD CONSTRAINT "pendaftaran_sidang_status_check"
    CHECK (status IN ('menunggu_jadwal', 'terjadwal', 'lulus', 'revisi'));

-- ============================================
-- Function & Trigger updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pengajuan_skripsi_updated_at ON "pengajuan_skripsi";
CREATE TRIGGER trg_pengajuan_skripsi_updated_at
BEFORE UPDATE ON "pengajuan_skripsi"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_logbook_bimbingan_updated_at ON "logbook_bimbingan";
CREATE TRIGGER trg_logbook_bimbingan_updated_at
BEFORE UPDATE ON "logbook_bimbingan"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pendaftaran_sidang_updated_at ON "pendaftaran_sidang";
CREATE TRIGGER trg_pendaftaran_sidang_updated_at
BEFORE UPDATE ON "pendaftaran_sidang"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
