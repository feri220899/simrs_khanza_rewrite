# Khanza Desktop

<!-- java -jar -Xss2m -Xms32m -Xmx1024m -XX:PermSize=32m -XX:MaxPermSize=512m khanza.jar -->

**Khanza Desktop** adalah eksperimen/riset pribadi untuk menjawab satu
pertanyaan: **seberapa jauh AI (dalam hal ini Claude/Claude Code) bisa
menulis ulang (rewrite) aplikasi lama berbasis Java Swing — SIMRS Khanza —
menjadi aplikasi desktop modern (Electron + Vue), tanpa kehilangan
kompatibilitas dengan database produksi yang sudah dipakai ribuan rumah
sakit?**

[SIMRS Khanza](https://github.com/kangGarr/Khanza) adalah SIMRS (Sistem
Informasi Manajemen Rumah Sakit) open source berbasis Java Swing yang paling
banyak dipakai rumah sakit/klinik di Indonesia. Project ini **bukan** fork
atau pengganti resmi Khanza — ini prototipe hasil kerja sama manusia + AI
yang mencoba menulis ulang modul-modulnya satu per satu, di atas skema
database (`sik.sql`) yang **sama persis** dengan yang dipakai aplikasi Java
aslinya.

> Status: **riset aktif, belum siap produksi.** Sebagian modul sudah
> tervalidasi jalan di atas database `sik` sungguhan, sebagian besar lain
> masih dalam proses ditulis ulang. Lihat [Status implementasi](#status-implementasi--riset)
> di bawah untuk peta progresnya.

## Kenapa project ini ada

SIMRS Khanza sudah berjalan bertahun-tahun di banyak rumah sakit, tapi UI
Java Swing-nya semakin sulit dipelihara, dan tidak ada Swing developer baru
yang bisa direkrut dengan mudah untuk hal ini. Alih-alih menulis ulang
seluruh sistem secara manual, project ini menguji apakah AI coding agent
bisa:

1. Membaca kode Java Swing lama (dialog, package, query SQL yang tertanam
   di dalamnya) sebagai spesifikasi.
2. Menulis ulang logika itu secara idiomatik di stack modern, modul demi
   modul, **tanpa mengubah skema database** — supaya aplikasi Electron ini
   dan aplikasi Java lama bisa hidup berdampingan dan membaca/menulis tabel
   yang sama secara real-time selama masa transisi.
3. Menjaga konsistensi arsitektur, konvensi, dan disiplin dokumentasi di
   ratusan modul tanpa harus dijelaskan ulang dari nol tiap sesi kerja.

Kalau hasilnya berhasil, artinya rumah sakit yang **sudah pakai Khanza
sekarang** punya jalur upgrade bertahap ke aplikasi modern — modul per
modul, bukan migrasi big-bang yang berisiko — tanpa mengganti database
produksinya sama sekali.

## Arah project: dari eksperimen ke aplikasi yang bisa dipakai RS

Rencana jangka panjangnya bukan cuma "membuktikan AI bisa nulis ulang kode",
tapi menghasilkan aplikasi yang benar-benar bisa dipasang berdampingan
dengan instalasi Khanza yang sudah berjalan:

- **Kompatibel database, bukan pengganti database.** Electron connect ke
  MySQL `sik` yang sama persis dengan yang dipakai `khanza.jar`. Tidak ada
  ETL, tidak ada database kedua, tidak ada proses cutover — begitu satu
  modul selesai ditulis ulang, RS bisa langsung pakai versi Electron-nya
  untuk modul itu sambil modul lain masih jalan di Java, karena keduanya
  baca/tulis tabel yang sama.
- **Migrasi bertahap per modul**, mengikuti urutan fase yang sudah dipetakan
  (lihat `../SIMRS-Khanza/Khanza.md` untuk mapping modul → dialog Java asli
  dan urutan migrasinya), bukan rewrite total sekaligus.
- **Auth & permission yang lebih granular** dari Java asli (role-based, lihat
  [Login & Permission](#login--permission)), tapi tetap bisa login dengan
  akun `admin`/`user` yang sudah ada di data RS — tidak perlu bikin ulang
  akun.
- **Bisa dipasang di banyak komputer klien** dalam satu RS, semua konek ke
  MySQL pusat yang sama, tanpa backend/API server tambahan yang perlu
  di-maintain terpisah.

Kalau eksperimen ini terbukti jalan, harapannya Khanza Desktop bisa jadi
opsi upgrade UI/UX untuk RS pengguna Khanza yang sudah ada — tanpa mereka
harus mengganti database, kehilangan data, atau melatih ulang staf dari nol
dalam satu hari.

## Kontribusi

Ini masih project riset skala kecil, tapi **kontribusi sangat terbuka dan
sangat dihargai** — baik dari sesama developer, maupun dari staf RS/rekam
medis yang paham betul alur kerja modul Khanza tertentu dan bisa bantu
validasi hasil rewrite-nya. Kalau kamu tertarik ikut:

- Buka issue/diskusi dulu untuk modul yang ingin dikerjakan, supaya tidak
  tumpang tindih dengan yang sedang berjalan.
- Baca `AGENTS.md` dan `../SIMRS-Khanza/Khanza.md` dulu — di situ ada
  konvensi, urutan migrasi, dan disiplin dokumentasi yang dipakai supaya
  progres tetap bisa dilanjutkan siapa pun (manusia atau AI agent lain)
  tanpa perlu di-brief ulang dari nol.
- Pull request untuk perbaikan, modul baru, atau sekadar laporan bug/temuan
  saat menguji lawan database `sik` sungguhan, semuanya diterima dengan
  senang hati. Terima kasih sebelumnya untuk siapa pun yang mau meluangkan
  waktu ikut project ini.

## Arsitektur

```
┌───────────────────────────┐        ┌──────────────────────────┐
│   Khanza Desktop (baru)   │        │   khanza.jar (lama)      │
│   Electron + Vue 3        │        │   Java Swing             │
│                           │        │                          │
│  renderer (Vue/Pinia) ───┐│        │                          │
│                          IPC        │                          │
│  main process ───────────┘│        │                          │
│   - mysql2 pool           │        │                          │
│   - service layer/module  │        │                          │
└─────────────┬─────────────┘        └─────────────┬────────────┘
              │                                     │
              └──────────────┬──────────────────────┘
                              ▼
                   MySQL — database `sik`
                   (skema sik.sql, SATU sumber data,
                    dibaca/ditulis real-time oleh keduanya)
```

Poin kunci arsitektur:

- **Tidak ada backend/API server terpisah.** Tiap komputer klien connect
  langsung ke MySQL `sik` pusat lewat koneksi (`mysql2` Pool) di main
  process Electron, di-expose ke renderer lewat IPC
  (`ipcMain.handle` + `contextBridge`) — bukan HTTP/axios ke
  `localhost:<port>`.
- **Skema database tidak diubah untuk kebutuhan Electron sendiri.** Tabel
  bisnis (rawat jalan, rawat inap, apotek, kasir, dll) memakai `sik.sql`
  apa adanya, sama persis dengan yang dibaca aplikasi Java. Tabel tambahan
  hanya untuk kebutuhan Electron sendiri (auth granular, prefix
  `electron_*`), lihat bagian Login & Permission.
- **Migration manual, tidak auto-run saat start.** App ini terpasang di
  banyak PC RS sekaligus ke satu MySQL pusat — auto-migrate tiap boot
  berisiko race condition. Migration dipicu manual oleh Administrator lewat
  Pengaturan, atau `npm run migrate` dari CLI, dan cukup dijalankan **sekali**
  dari satu PC per instalasi RS.
- **Tidak ada backup otomatis dari aplikasi ini** (sengaja) — backup
  database `sik` sudah jadi tanggung jawab rutin sisi server/DBA RS.
  Fitur Pengaturan → Database menegaskan lewat konfirmasi eksplisit bahwa
  backup manual wajib dilakukan sebelum aksi yang mengubah skema.
- **Kredensial (MySQL/MinIO) tidak pernah hardcode atau ikut ke installer
  publik** — diisi per instalasi lewat layar Pengaturan Awal, disimpan
  terenkripsi (`safeStorage` Electron) di komputer masing-masing. Lihat
  [Konfigurasi](#konfigurasi-mysql--minio) di bawah.

### Stack

| Layer | Teknologi |
|---|---|
| Desktop shell | Electron |
| UI | Vue 3, Vue Router, Pinia, Tailwind CSS + daisyUI |
| Database | MySQL (`mysql2`), skema `sik.sql` asli |
| Auth | Role/permission ternormalisasi di atas tabel `admin`/`user` asli |
| Storage opsional | MinIO (lampiran file, mis. Surat) |
| Auto-update | `electron-updater` (channel GitHub Releases) |

## Login & Permission

Tidak ada tabel akun baru (`electron_users`) — akun tetap satu sumber dari
tabel asli Khanza, hanya lapisan role/permission-nya yang baru:

| Kebutuhan | Sumber |
|---|---|
| Login **Admin Utama** | Tabel `admin` asli (`usere`/`passworde`, `AES_ENCRYPT` — sama persis `src/fungsi/akses.java`). Cocok → akses penuh hardcode, sama seperti kelakuan Java. |
| Login **user biasa** | Tabel `user` asli (`id_user`/`password`, `AES_ENCRYPT` sama). Cocok → role dicari di `electron_user_roles`. |
| Role | `electron_roles` |
| Daftar permission | `electron_permissions` (seed dari slug asli Khanza + slug baru Electron) |
| Role ↔ permission | `electron_role_permissions` |
| User ↔ role | `electron_user_roles` |

Semua pengecekan izin di Electron 100% role-based lewat
`electron_role_permissions` — kolom boolean permission individual di tabel
`user` asli hanya dipakai sekali sebagai daftar nama slug saat seeding, tidak
pernah dibaca lagi sebagai sumber otorisasi.

Pengaturan → Database menyediakan **Pembanding Skema** (upload `sik.sql`
versi baru RS, dibandingkan ke database live, deteksi tabel/kolom baru) dan
**Sinkronisasi Permission** (deteksi kolom `user` yang belum punya slug
permission Electron) — dua-duanya untuk menjaga instalasi RS tetap sinkron
saat skema Khanza upstream berubah.

## Setup

```bash
npm install
cp .env.example .env   # dev lokal & `npm run migrate` (CLI, di luar Electron)
npm run migrate         # jalankan migration electron_* (roles/permissions/role_permissions/user_roles)
npm run dev              # jalankan app
```

Login pakai akun `admin`/`user` yang **sudah ada** di data `sik.sql` yang
kamu pakai — bukan seed baru.

### Linux: error FATAL sandbox saat `npm run dev`

Electron di Linux butuh `chrome-sandbox` dimiliki `root` dengan bit setuid
(bukan spesifik project ini, semua app Electron butuh ini):

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

### Bypass Aktivasi Lisensi untuk dev lokal

Server lisensi Khanza belum ada, jadi `Aktivasi.vue` otomatis di-skip kalau
`import.meta.env.DEV` true (cuma jalan lewat `npm run dev`, tidak pernah di
build production).

## Konfigurasi MySQL & MinIO

Kredensial produksi **tidak lewat `.env`** — app open source ini dipakai
banyak RS lain yang MySQL `sik`/MinIO-nya beda-beda per lokasi, jadi tidak
boleh ada satu `.env` hardcoded yang ikut ke installer publik. Dipecah jadi:

- **Layar "Pengaturan Awal"** (sebelum Aktivasi/Login, muncul otomatis di
  buka pertama kali) — cuma MySQL, satu-satunya yang app benar-benar tidak
  bisa jalan tanpanya. Tombol "Cek Koneksi" wajib sukses dulu sebelum bisa
  lanjut.
- **Pengaturan → Environment** (setelah login) — MySQL bisa diedit lagi di
  sini, plus config service pihak ketiga opsional (MinIO, dst) yang boleh
  dikosongkan/diisi belakangan.

Keduanya tersimpan terenkripsi (`safeStorage` Electron, terikat akun OS)
di `app.getPath('userData')/config.dat`. Tersedia juga **Export/Import
konfigurasi** berbasis passphrase (AES-256-GCM + `scrypt`) untuk rollout ke
banyak PC dalam satu RS tanpa mengetik ulang kredensial manual di tiap
komputer — hapus file hasil export setelah dipakai.

`.env` hanya dipakai untuk 2 hal: `npm run dev` (fallback kalau Pengaturan
Awal belum diisi di komputer dev) dan `npm run migrate` (CLI murni Node,
tanpa Electron, selalu baca `.env`, tidak pernah baca `config.dat`).

## Status implementasi & riset

Peta lengkap modul → dialog Java asli, urutan migrasi (Fase 0–6), dan
keputusan arsitektur ada di `../SIMRS-Khanza/Khanza.md` — dokumen itu adalah
rencana kerja yang sebenarnya, bukan file ini. Ringkasan progres saat ini:

- **Fase 0 (Auth/role/permission)** — selesai, tervalidasi di atas database
  `sik` sungguhan.
- **Modul yang sudah punya service layer + halaman** (lihat
  `src/main/db/modules/` dan `src/renderer/src/views/`): Parkir,
  Perpustakaan, Surat Masuk/Keluar, IPSRS, Toko, dan beberapa laporan
  e-Eksekutif (Kendali Mutu, Inventori Farmasi/Dapur/Non-Medis, Pendapatan
  Kasir).
- Modul lain masih placeholder atau belum digarap.

Status ini bisa cepat basi — sebelum mengasumsikan sesuatu "belum ada",
cek langsung `git log`, `src/main/db/modules/`, dan
`src/renderer/src/views/` sebagai sumber kebenaran, bukan bagian ini.
