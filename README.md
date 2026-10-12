# 🚀 SIM Skripsi Backend RESTful API (`SIM_SKRIPSI_BE`)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue.svg?style=flat-square&logo=mysql)](https://www.mysql.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT_SSO-orange.svg?style=flat-square)](https://jwt.io/)
[![Multer](https://img.shields.io/badge/File_Upload-Multer-red.svg?style=flat-square)](https://github.com/expressjs/multer)

Backend RESTful API mandiri untuk layanan **Sistem Informasi Manajemen Skripsi (SIM Skripsi)**. Repositori ini melayani seluruh kebutuhan pertukaran data pengajuan judul, logbook bimbingan, pendaftaran seminar/sidang, upload berkas digital PDF, dan penilaian ujian skripsi. Backend ini terintegrasi penuh dengan ekosistem Single Sign-On (SSO) [sim-mhs-api](https://github.com/erxanz/sim-mhs-api).

---

## 📋 Daftar Isi
1. [Fitur & Kemampuan Utama](#-fitur--kemampuan-utama)
2. [Arsitektur & Teknologi](#-arsitektur--teknologi)
3. [Struktur Folder](#-struktur-folder)
4. [Skema Basis Data](#-skema-basis-data)
5. [Mekanisme Autentikasi SSO (JWT)](#-mekanisme-autentikasi-sso-jwt)
6. [Panduan Instalasi & Menjalankan Lokal](#-panduan-instalasi--menjalankan-lokal)
7. [Daftar Endpoint API (API Reference)](#-daftar-endpoint-api-api-reference)

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
* **Runtime**: Node.js (ES Module / `"type": "module"`)
* **Framework**: Express.js
* **Database Driver**: `mysql2/promise` (Connection Pooling)
* **Keamanan**: `jsonwebtoken`, `cors`, `dotenv`
* **File Upload**: `multer` disk storage

---

## 📂 Struktur Folder
```text
SIM_SKRIPSI_BE/
├── src/
│   ├── config/
│   │   └── database.js         # Pool koneksi MySQL2
│   ├── controllers/
│   │   ├── pengajuanController.js
│   │   ├── bimbinganController.js
│   │   ├── seminarController.js
│   │   └── nilaiController.js
│   ├── middlewares/
│   │   ├── authMiddleware.js   # Verifikasi Bearer Token JWT SSO & RBAC
│   │   └── uploadMiddleware.js # Filter & simpan file PDF via Multer
│   ├── routes/
│   │   ├── pengajuanRoutes.js
│   │   ├── bimbinganRoutes.js
│   │   ├── seminarRoutes.js
│   │   └── nilaiRoutes.js
│   └── app.js                  # Setup Express, static uploads, & routes
├── uploads/                    # Folder penyimpanan PDF naskah & proposal
├── generate_token.js           # CLI generator token JWT dummy untuk uji coba
├── schema.sql                  # Skrip SQL pembuatan tabel database
├── .env.example                # Template konfigurasi variabel lingkungan
├── package.json
└── server.js                   # Entry point aplikasi (port 5000)
```

---

## 🗄️ Skema Basis Data (`db_sim_skripsi`)

### 1. Tabel `pengajuan_skripsi`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` (PK) | Identitas unik pengajuan |
| `nim` | `VARCHAR(20)` | NIM mahasiswa pengusul |
| `nama_mahasiswa` | `VARCHAR(100)` | Nama lengkap mahasiswa |
| `prodi_id` | `INT` | ID Program Studi |
| `judul` | `TEXT` | Judul penelitian skripsi |
| `bidang_kajian` | `VARCHAR(100)` | Topik / keahlian kajian |
| `abstrak` | `TEXT` | Rangkuman proposal |
| `file_proposal` | `VARCHAR(255)` | Nama file PDF di folder uploads |
| `dosen_pembimbing_1_nip` | `VARCHAR(30)` | NIP Pembimbing Utama |
| `dosen_pembimbing_1_nama`| `VARCHAR(100)`| Nama Pembimbing Utama |
| `dosen_pembimbing_2_nip` | `VARCHAR(30)` | NIP Pembimbing Pendamping |
| `dosen_pembimbing_2_nama`| `VARCHAR(100)`| Nama Pembimbing Pendamping |
| `status` | `ENUM` | `'draft'`, `'diajukan'`, `'disetujui'`, `'ditolak'` |
| `catatan_verifikasi` | `TEXT` | Catatan revisi dari prodi |
| `created_at` / `updated_at` | `TIMESTAMP` | Waktu pencatatan |

### 2. Tabel `logbook_bimbingan`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` (PK) | ID entri konsultasi |
| `skripsi_id` | `INT` (FK) | Relasi ke `pengajuan_skripsi.id` |
| `nim` | `VARCHAR(20)` | Mahasiswa bersangkutan |
| `dosen_nip` | `VARCHAR(30)` | Dosen yang dituju |
| `dosen_nama` | `VARCHAR(100)` | Nama lengkap dosen |
| `tanggal_bimbingan` | `DATE` | Tanggal pertemuan konsultasi |
| `catatan_mahasiswa` | `TEXT` | Progres & materi diskusi mahasiswa |
| `catatan_dosen` | `TEXT` | Evaluasi & arahan perbaikan dosen |
| `file_revisi` | `VARCHAR(255)` | Berkas draf bab revisi (PDF) |
| `status_acc` | `ENUM` | `'pending'`, `'revisi'`, `'acc'` |

### 3. Tabel `pendaftaran_sidang`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` (PK) | ID pendaftaran ujian |
| `skripsi_id` | `INT` (FK) | Relasi ke `pengajuan_skripsi.id` |
| `jenis_sidang` | `ENUM` | `'sempro'`, `'semhas'`, `'sidang_akhir'` |
| `file_naskah` | `VARCHAR(255)` | Berkas naskah lengkap (PDF) |
| `jadwal_sidang` | `DATETIME` | Waktu pelaksanaan ujian |
| `ruangan` | `VARCHAR(100)` | Ruang ujian / link virtual |
| `status` | `ENUM` | `'menunggu_jadwal'`, `'terjadwal'`, `'lulus'`, `'revisi'` |
| `nilai_akhir` | `DECIMAL(5,2)` | Nilai akumulasi (skala 0 - 100) |
| `catatan_sidang` | `TEXT` | Catatan dari dewan penguji |

---

## 🔐 Mekanisme Autentikasi SSO (JWT)
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

---

## 💻 Panduan Instalasi & Menjalankan Lokal

1. **Masuk ke folder backend**:
   ```bash
   cd SIM_SKRIPSI_BE
   ```

2. **Pasang dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**:
   Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Pastikan variabel database sesuai dengan Laragon/MySQL Anda:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=db_sim_skripsi
   JWT_SECRET=rahasia_bersama_sim_mahasiswa_sso
   ```

4. **Import Skema Database**:
   Jalankan file `schema.sql` ke MySQL:
   ```bash
   mysql -u root db_sim_skripsi < schema.sql
   ```

5. **Generate Token Dummy untuk Uji Coba**:
   ```bash
   node generate_token.js
   ```

6. **Jalankan Server**:
   ```bash
   npm run dev
   ```
   Server aktif di: `http://localhost:5000`

---

## 📡 Daftar Endpoint API (API Reference)

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
