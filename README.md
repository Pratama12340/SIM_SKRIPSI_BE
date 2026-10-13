# 🚀 SIM Skripsi Backend RESTful API (`SIM_SKRIPSI_BE`)

[![Node.js](https://img.shields.io/badge/Node.js-v20.19+-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791.svg?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma_ORM-7.x-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![JWT](https://img.shields.io/badge/Auth-JWT_SSO-orange.svg?style=flat-square)](https://jwt.io/)
[![Multer](https://img.shields.io/badge/File_Upload-Multer-red.svg?style=flat-square)](https://github.com/expressjs/multer)

Backend RESTful API mandiri untuk layanan **Sistem Informasi Manajemen Skripsi (SIM Skripsi)**. Repositori ini melayani seluruh kebutuhan pertukaran data pengajuan judul, logbook bimbingan, pendaftaran seminar/sidang, upload berkas digital PDF, dan penilaian ujian skripsi. Backend terintegrasi penuh dengan ekosistem Single Sign-On (SSO) [sim-mhs-api](https://github.com/erxanz/sim-mhs-api).

> **Catatan migrasi:** Project ini dimigrasikan dari **MySQL/MariaDB + mysql2** ke **PostgreSQL (Neon) + Prisma ORM 7**. Kontrak API (endpoint, header, bentuk JSON `snake_case`, nilai status, perilaku error) dipertahankan seperti semula.

---

## 📋 Daftar Isi
1. [Fitur & Kemampuan Utama](#-fitur--kemampuan-utama)
2. [Arsitektur & Teknologi](#-arsitektur--teknologi)
3. [Struktur Folder](#-struktur-folder)
4. [Persiapan Database Neon](#-persiapan-database-neon)
5. [Konfigurasi `.env`](#-konfigurasi-env)
6. [Migrasi Database (Prisma Migrate)](#-migrasi-database-prisma-migrate)
7. [Seed Data Dummy](#-seed-data-dummy)
8. [Menjalankan Server & Tes Endpoint](#-menjalankan-server--tes-endpoint)
9. [Skema Basis Data](#-skema-basis-data)
10. [Autentikasi SSO (JWT)](#-autentikasi-sso-jwt)
11. [Daftar Endpoint API](#-daftar-endpoint-api)
12. [Catatan Teknis & Troubleshooting](#-catatan-teknis--troubleshooting)

---

## ⚡ Fitur & Kemampuan Utama
* **Pengajuan Judul Skripsi**: CRUD pengajuan usulan judul, bidang kajian, abstrak, dan upload berkas proposal PDF.
* **Logbook Bimbingan**: Dokumentasi histori konsultasi mahasiswa, upload draf revisi PDF, tanggapan pembimbing, dan status ACC.
* **Seminar & Sidang**: Pendaftaran Sempro, Semhas, dan Sidang Akhir, plotting jadwal ujian, dan penentuan ruangan/link ujian.
* **Penilaian Ujian**: Input nilai dewan penguji (skala 0–100) dan keputusan kelulusan.
* **Stateless SSO Authentication**: Verifikasi token JWT tanpa perlu mengelola tabel login tersendiri.
* **Manajemen Berkas Digital**: Validasi upload berkas PDF dengan batas ukuran hingga 15MB via Multer.

---

## 🛠️ Arsitektur & Teknologi
* **Runtime**: Node.js ≥ 20.19 (ES Module / `"type": "module"`)
* **Framework**: Express.js
* **Database**: PostgreSQL (Neon) — **bukan lagi MySQL/MariaDB**
* **ORM**: Prisma ORM **7.10** (`prisma` CLI + `@prisma/client`)
* **Driver adapter**: `@prisma/adapter-pg` (koneksi TCP pooling standar Node; cocok untuk server Express yang selalu hidup)
* **Keamanan**: `jsonwebtoken`, `cors`, `dotenv`
* **File Upload**: `multer` disk storage
* **Testing**: `scripts/smoke-test.mjs` (tanpa dependensi eksternal, memakai `fetch` bawaan Node)

> Untuk deployment serverless/edge (Vercel Functions, Cloudflare Workers), driver adapter dapat ditukar ke `@prisma/adapter-neon` sesuai [panduan resmi Neon](https://neon.com/docs/guides/prisma). Konfigurasi saat ini dioptimalkan untuk server Express yang berjalan terus-menerus.

---

## 📂 Struktur Folder
```text
SIM_SKRIPSI_BE/
├── prisma/
│   ├── schema.prisma           # Sumber kebenaran skema (3 tabel, relasi, index)
│   ├── migrations/
│   │   ├── migration_lock.toml # provider = postgresql
│   │   └── 0_init/             # Migrasi awal (DDL + CHECK + trigger), terlacak di Git
│   └── seed.js                 # Seed dummy idempotent (npm run seed)
├── prisma.config.ts            # Konfigurasi Prisma CLI (URL direkt, path migrasi, seed)
├── src/
│   ├── config/
│   │   └── database.js         # Prisma Client + @prisma/adapter-pg
│   ├── controllers/            # 4 controller (query PostgreSQL via Prisma)
│   ├── middlewares/            # authMiddleware (JWT SSO) & uploadMiddleware (Multer)
│   ├── routes/                 # Route API (kontrak tidak berubah)
│   ├── utils/
│   │   └── apiHelpers.js       # parseId + mapping error PG/Prisma ke HTTP
│   ├── generated/prisma/       # Hasil `prisma generate` (di-.gitignore)
│   └── app.js                  # Setup Express, static uploads, & routes
├── scripts/
│   └── smoke-test.mjs          # Tes endpoint end-to-end (39 pemeriksaan)
├── uploads/                    # Folder penyimpanan PDF naskah & proposal
├── generate_token.js           # CLI generator token JWT dummy (node generate_token.js)
├── schema.sql                  # Referensi DDL SQL (dipakai bila membuat tabel manual)
├── .env / .env.example         # Konfigurasi environment (JANGAN commit .env)
├── package.json
└── server.js                   # Entry point aplikasi
```

---

## 🌊 Persiapan Database Neon

1. Buat akun & project di [Neon Console](https://console.neon.tech/).
2. Klik **Connect**, salin **dua connection string**:
   * **Pooled** (hostname berakhiran `-pooler`) → untuk aplikasi → variabel `DATABASE_URL`
   * **Direct / unpooled** (tanpa `-pooler`) → untuk Prisma CLI (migrate/seed/studio) → variabel `DIRECT_URL`
3. (Opsional, untuk `migrate dev`) Buat **database/branch khusus** sebagai shadow database → variabel `SHADOW_DATABASE_URL`. **Jangan** memakai database produksi sebagai shadow.

> Neon berskala-nol (compute tidur setelah idle). Sisipkan `connect_timeout=15` pada URL aplikasi bila muncul `P1001: Can't reach database server`.

---

## 🔐 Konfigurasi `.env`

```bash
cp .env.example .env
```

Lalu isi nilai Neon Anda:

```env
PORT=5000
NODE_ENV=development

# Koneksi POOLED untuk aplikasi (Prisma Client runtime)
DATABASE_URL="postgresql://USER:PASSWORD@endpoint-pooler.region.aws.neon.tech/dbname?sslmode=require&connect_timeout=15"
# Koneksi DIRECT untuk Prisma CLI (migrate, seed, studio)
DIRECT_URL="postgresql://USER:PASSWORD@endpoint.region.aws.neon.tech/dbname?sslmode=require"

# Opsional: shadow DB untuk `npm run migrate:dev` di Neon
# SHADOW_DATABASE_URL="postgresql://USER:PASSWORD@endpoint.region.aws.neon.tech/shadow_dbname?sslmode=require"

# Harus sama dengan nilai di sim-mhs-api agar token SSO diterima
JWT_SECRET=rahasia_bersama_sim_mahasiswa_sso
JWT_ISSUER=sim-mhs-api
```

Kabar baiknya:
* File `.env` **sudah masuk `.gitignore`** — tidak akan ter-commit.
* Prisma CLI 7 **tidak membaca `.env` secara otomatis**; `prisma.config.ts` memuatnya lewat `import 'dotenv/config'`, sehingga semua perintah `npm run migrate:*` langsung membaca `.env`.

---

## 🗄️ Migrasi Database (Prisma Migrate)

Workflow resmi: **`migrate dev` untuk pengembangan, `migrate deploy` untuk produksi.** `db push` **tidak** dipakai.

```bash
npm install          # sekali di awal
npm run generate     # generate Prisma Client ke src/generated/prisma
```

### Kasus A — Database Neon masih kosong (belum ada tabel)
```bash
npm run migrate:deploy   # menerapkan prisma/migrations/0_init
npm run seed             # (opsional) isi data dummy
```

### Kasus B — Tabel sudah ada di database (baseline/adopsi)
Jika tabel `pengajuan_skripsi`, `logbook_bimbingan`, `pendaftaran_sidang` sudah dibuat sebelumnya (misal dari `schema.sql`), `migrate deploy` akan menolak dengan error **P3005**. Tandai migrasi awal sebagai sudah diterapkan (**sekali saja**):

```bash
npm run migrate:baseline    # == prisma migrate resolve --applied 0_init
npm run migrate:status      # verifikasi: "Database schema is up to date!"
npm run migrate:deploy      # sejak itu berjalan normal untuk migrasi berikutnya
```

> ⚠️ Langkah ini **tidak menghapus/menimpa data apa pun** — hanya mencatat bahwa skema saat ini sudah sesuai `0_init`. Selalu jalankan `npm run migrate:status` lebih dulu sebelum memutuskan.

### Kasus C — Pengembangan harian (perubahan skema)
```bash
npm run migrate:dev        # membuat migrasi baru dari perubahan schema.prisma
```
* Di Neon, `migrate dev` membutuhkan shadow database → isi `SHADOW_DATABASE_URL` dulu (branch/database khusus).
* CHECK constraint & trigger didefinisikan manual di `prisma/migrations/0_init/migration.sql` (Prisma tidak mengekspresikannya di `schema.prisma`), dan **sudah teruji tidak menimbulkan drift** (`migrate dev` melapor *Already in sync*).

### Perintah terkait
| Script | Fungsi |
|---|---|
| `npm run generate` | Generate Prisma Client |
| `npm run migrate:dev` | Buat/terapkan migrasi (development) |
| `npm run migrate:deploy` | Terapkan migrasi (production) |
| `npm run migrate:status` | Cek status migrasi database |
| `npm run migrate:baseline` | Tandai `0_init` sebagai applied (adopsi tabel lama) |
| `npm run seed` | Jalankan seed dummy |
| `npm run studio` | Buka Prisma Studio (GUI database) |
| `npm run token` | Generate token JWT dummy |

---

## 🌱 Seed Data Dummy

```bash
npm run seed
```

* Berisi 3 pengajuan (disetujui/draft/diajukan), 2 logbook bimbingan, 2 pendaftaran sidang untuk NIM `20260001/2/3` — sengaja disamakan dengan token dummy `generate_token.js`.
* **Idempotent**: baris yang sudah ada dilewati — aman dijalankan berulang, tidak ada `UPDATE`/`DELETE`, tidak menimpa data produksi.
* **Tabel `dosen` & `program_studi` sengaja tidak dibuat** — datanya berasal dari layanan lain (sim-mhs-api/SSO). Kolom `*_nip`, `*_nama`, `prodi_id` pada tabel skripsi hanya referensi denormalisasi (VARCHAR/INT), bukan foreign key ke tabel lokal.

---

## ▶️ Menjalankan Server & Tes Endpoint

```bash
# 1. Pastikan .env terisi, migrasi & seed selesai
npm run dev                 # atau: npm start

# 2. Buat token JWT dummy (MAHASISWA / DOSEN / KAPRODI)
npm run token

# 3. Tes seluruh endpoint (server harus sudah berjalan)
node scripts/smoke-test.mjs                      # default http://localhost:5000
node scripts/smoke-test.mjs http://localhost:5100 # atau URL lain
```

Smoke test melakukan **39 pemeriksaan**: health check, autentikasi 401/403, RBAC per role, CRUD keempat modul, upload PDF multipart, validasi nilai/status, guard pendaftaran ganda, konversi jadwal, serta kontrak serialisasi (kunci `snake_case`, `COUNT` sebagai number, DECIMAL sebagai string `"88.50"`).

Contoh tes manual dengan curl:

```bash
TOKEN=$(node -e "import('./generate_token.js').then(m=>console.log(m.createToken({id:5,username:'20260001',nama:'Contoh Mahasiswa',role:'MAHASISWA',prodi_id:1})))")

curl -s http://localhost:5000/health
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/pengajuan
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/pengajuan/1
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/bimbingan/1
curl -s http://localhost:5000/api/seminar/jadwal
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/nilai/1
```

> Catatan: smoke test menyisipkan 1 baris pendaftaran `semhas` pada run pertama dan memperbarui jadwal pendaftaran `id=1` serta nilai pendaftaran `id=2` sebagai fixture — nilainya dikembalikan ke kondisi seed di akhir tes.

---

## 🗄️ Skema Basis Data (`db_sim_skripsi`)

Sumber kebenaran: `prisma/schema.prisma` + `prisma/migrations/0_init/migration.sql` (identik dengan `schema.sql`).

### 1. Tabel `pengajuan_skripsi`
| Kolom | Tipe Data (PG) | Keterangan |
|---|---|---|
| `id` | `SERIAL` (PK) | Identitas unik pengajuan |
| `nim` | `VARCHAR(20)` | NIM mahasiswa pengusul (index `idx_nim`) |
| `nama_mahasiswa` | `VARCHAR(100)` | Nama lengkap mahasiswa |
| `prodi_id` | `INT` nullable | ID Program Studi (dari sim-mhs-api) |
| `judul` | `TEXT` | Judul penelitian skripsi |
| `bidang_kajian` | `VARCHAR(100)` | Topik / keahlian kajian |
| `abstrak` | `TEXT` | Rangkuman proposal |
| `file_proposal` | `VARCHAR(255)` | Nama file PDF di folder uploads |
| `dosen_pembimbing_{1,2}_nip/nama` | `VARCHAR(30)/(100)` | Data pembimbing (index `idx_dosen1/2`) |
| `status` | `VARCHAR(20)` + **CHECK** | `'draft'`, `'diajukan'`, `'disetujui'`, `'ditolak'` (index `idx_status`) |
| `catatan_verifikasi` | `TEXT` | Catatan revisi dari prodi |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `updated_at` dijaga **trigger** `update_updated_at_column()` |

### 2. Tabel `logbook_bimbingan`
| Kolom | Tipe Data (PG) | Keterangan |
|---|---|---|
| `id` | `SERIAL` (PK) | ID entri konsultasi |
| `skripsi_id` | `INT` FK → `pengajuan_skripsi.id` | **ON DELETE CASCADE** (`fk_logbook_skripsi`) |
| `nim`, `dosen_nip`, `dosen_nama` | `VARCHAR` | Mahasiswa & dosen yang menangani |
| `tanggal_bimbingan` | `DATE` | Tanggal pertemuan konsultasi |
| `catatan_mahasiswa` / `catatan_dosen` | `TEXT` | Isi logbook |
| `file_revisi` | `VARCHAR(255)` | Berkas draf bab revisi (PDF) |
| `status_acc` | `VARCHAR(20)` + **CHECK** | `'pending'`, `'revisi'`, `'acc'` |

### 3. Tabel `pendaftaran_sidang`
| Kolom | Tipe Data (PG) | Keterangan |
|---|---|---|
| `id` | `SERIAL` (PK) | ID pendaftaran ujian |
| `skripsi_id` | `INT` FK → `pengajuan_skripsi.id` | **ON DELETE CASCADE** (`fk_sidang_skripsi`) |
| `jenis_sidang` | `VARCHAR(20)` + **CHECK** | `'sempro'`, `'semhas'`, `'sidang_akhir'` |
| `file_naskah` | `VARCHAR(255)` | Berkas naskah lengkap (PDF) |
| `jadwal_sidang` | `TIMESTAMPTZ` | Waktu pelaksanaan ujian |
| `ruangan` | `VARCHAR(100)` | Ruang ujian / link virtual |
| `status` | `VARCHAR(30)` + **CHECK** | `'menunggu_jadwal'`, `'terjadwal'`, `'lulus'`, `'revisi'` (index `idx_status_sidang`) |
| `nilai_akhir` | `NUMERIC(5,2)` | Nilai akumulasi (skala 0–100) |
| `catatan_sidang` | `TEXT` | Catatan dari dewan penguji |

---

## 🔐 Autentikasi SSO (JWT)
Backend memverifikasi token yang diterbitkan oleh [sim-mhs-api](https://github.com/erxanz/sim-mhs-api). Format header:
```http
Authorization: Bearer <TOKEN_JWT_DARI_SSO>
```

Format payload yang didukung:
```json
{
  "sub": "5",
  "username": "20260001",
  "nama": "Contoh Mahasiswa",
  "role": "MAHASISWA",
  "scope": {
    "idUniversitas": "1",
    "idFakultas": "1",
    "idProgramStudi": "1"
  },
  "typ": "access",
  "iss": "sim-mhs-api"
}
```

Tidak ada tabel login baru yang dibuat — verifikasi sepenuhnya stateless via `JWT_SECRET` yang sama dengan `sim-mhs-api`.

---

## 📡 Daftar Endpoint API

| Method | Endpoint | Deskripsi | Hak Akses |
|:---:|---|---|:---:|
| `GET` | `/health` | Pemeriksaan status server | Publik |
| `GET` | `/api/pengajuan` | Mengambil daftar pengajuan skripsi | Mahasiswa / Dosen / Admin |
| `GET` | `/api/pengajuan/:id` | Detail lengkap pengajuan judul | Mahasiswa / Dosen / Admin |
| `POST` | `/api/pengajuan/submit` | Pengajuan draf judul & upload proposal PDF | `MAHASISWA` |
| `PUT` | `/api/pengajuan/:id/status`| Verifikasi judul & plotting dosen pembimbing | `DOSEN`, `KAPRODI`, `ADMIN` |
| `DELETE`| `/api/pengajuan/:id` | Menghapus draft usulan judul | `MAHASISWA`, `ADMIN` |
| `GET` | `/api/bimbingan/:skripsiId` | Riwayat logbook bimbingan per skripsi | Mahasiswa / Dosen / Admin |
| `POST` | `/api/bimbingan/tambah` | Tambah logbook & upload draf revisi PDF | `MAHASISWA` |
| `PUT` | `/api/bimbingan/:id/acc` | Memberi arahan revisi & status ACC | `DOSEN`, `KAPRODI`, `ADMIN` |
| `GET` | `/api/seminar/jadwal` | Jadwal agenda seminar proposal & sidang | Publik / Civitas |
| `POST` | `/api/seminar/daftar` | Mendaftar Sempro, Semhas, atau Sidang Akhir | `MAHASISWA` |
| `PUT` | `/api/seminar/:id/jadwal`| Plotting tanggal & ruangan ujian | `DOSEN`, `KAPRODI`, `ADMIN` |
| `GET` | `/api/nilai/:id` | Detail nilai ujian sidang | Mahasiswa / Dosen / Admin |
| `PUT` | `/api/nilai/:id` | Input nilai akhir & kelulusan sidang | `DOSEN`, `KAPRODI`, `ADMIN` |

---

## 📝 Catatan Teknis & Troubleshooting

**Kontrak API dipertahankan (teruji oleh smoke test):**
* Semua kunci JSON tetap `snake_case` (mis. `nama_mahasiswa`, `total_bimbingan`) — query dibaca lewat `$queryRaw` sehingga nama kolom identik dengan mysql2 sebelumnya.
* `COUNT(*)` di-`cast` ke `::int` agar tidak pernah menghasilkan `BigInt` (yang akan membuat `JSON.stringify` gagal).
* `nilai_akhir` (`NUMERIC`) di-`cast` ke `::text` sehingga serialisasinya tetap string `"88.50"` seperti mysql2, bukan angka.
* Urutan jadwal memakai `ORDER BY jadwal_sidang ASC NULLS FIRST` — meniru perilaku MySQL (NULL dulu) sehingga urutan daftar tidak berubah.
* Parameter `:id` yang tidak numerik kini memberi **400/404 yang rapi** (via `apiHelpers.sendError`) alih-alih error 500; error PostgreSQL dipetakan: `23505`→409, `23503`→400, `23514` (CHECK)→400, `22P02`/`22007`/`22008` (tanggal)→400.

**Zona waktu:**
* Kolom `jadwal_sidang` bertipe `TIMESTAMPTZ` (perilaku benar secara zona waktu). Kirim nilai sudah ber-offset (mis. `2026-10-25T09:00:00+07:00`) agar instan waktu tepat; respons selalu berformat ISO-8601 UTC (`...Z`).
* Kolom `tanggal_bimbingan` (`DATE`) dirender sebagai tengah malam UTC (`2026-09-24T00:00:00.000Z`) — tampilkan dengan `toLocaleDateString()` agar tanggal tidak bergeser.

**Troubleshooting:**
| Gejala | Penyebab / Solusi |
|---|---|
| `P3005` saat `migrate:deploy` | Database sudah berisi tabel → jalankan `npm run migrate:baseline` sekali (lihat Kasus B) |
| `P1001: Can't reach database server` | Neon compute bangun dari scale-to-zero → tambah `connect_timeout=15` di `DATABASE_URL` |
| `PrismaConfigEnvError: Cannot resolve environment variable` | Variabel `DIRECT_URL` belum ada di `.env` |
| Gagal verifikasi token SSO | `JWT_SECRET` di `.env` harus sama persis dengan `sim-mhs-api` |
| `bcrypt`/SSL error koneksi Neon | Pastikan `sslmode=require` ada di kedua URL |
| Setelah `npm install` muncul error modul `src/generated/prisma` | Jalankan `npm run generate` (folder generated tidak di-commit) |

**Keamanan dependensi:** `npm audit` melaporkan kerentanan pada *dependency internal* `prisma` CLI (`mysql2`, `deepmerge-ts`) — hanya ikut terpasang sebagai alat develop, **tidak diekspor atau dipakai oleh aplikasi saat runtime**.

**Tidak diuji di sini:** koneksi langsung ke instance Neon Anda (butuh kredensial asli di `.env`). Seluruh alur — migrate, baseline, seed (2×), 39 titik tes endpoint, studio, dan generate — telah diuji terhadap **PostgreSQL 17 lokal** dengan konfigurasi yang sama.
