# Khanza Desktop

Rewrite SIMRS Khanza (Java Swing, lihat `../SIMRS-Khanza`) ke Electron. **Baca
`../SIMRS-Khanza/Khanza.md` dulu sebelum mengerjakan modul apa pun** — dokumen
itu adalah rencana lengkap (mapping modul, urutan migrasi, SOP wajib, arsitektur
lisensi & UI). File ini cuma catatan teknis cara jalankan project.

## Beda dari referensi (`pos-desktop`)

Struktur folder & pola UI (sidebar, permission, komponen) mengikuti
`~/Documents/PRIBADI/Wails/POS_LISENSI/pos-desktop`, tapi:

- **Postgres**, bukan SQLite — dan dipakai **untuk semua modul sejak awal**
  (keputusan eksplisit, lihat Khanza.md > "Prinsip Migrasi Data"). Konsekuensi:
  modul yang masih dipakai bareng app Java (MySQL) butuh strategi ETL/cutover
  sendiri, tidak bisa share tabel real-time.
- **Tidak ada Express/backend server terpisah.** Tiap komputer klien connect
  langsung ke Postgres pusat lewat koneksi di main process (`pg` Pool),
  di-expose ke renderer lewat IPC (`ipcMain.handle` + `contextBridge`), bukan
  HTTP/axios ke `localhost:<port>`.
- Migration pakai runner custom (numbered files, tabel `migrations`, backup
  `pg_dump` sebelum migrasi jalan pada instalasi yang sudah ada datanya) — pola
  sama seperti referensi, cuma ganti `better-sqlite3` → `pg`.
- **Migration TIDAK auto-run saat app start** (beda dari referensi) — app ini
  di-install di banyak PC RS sekaligus ke satu Postgres pusat, auto-migrate
  tiap boot berisiko race condition. Migration cuma bisa dipicu manual oleh
  **Administrator** lewat tombol di Pengaturan (role dicek ulang di IPC
  handler, bukan cuma disembunyikan di UI) atau `npm run migrate` dari CLI.

## Setup

```bash
npm install
cp .env.example .env   # isi kredensial Postgres & JWT_SECRET yang sebenarnya
npm run migrate         # WAJIB dijalankan manual sekali di awal — app TIDAK auto-migrate
npm run dev              # jalankan app
```

Alternatif buat instalasi pertama: **tidak perlu buka terminal** — cukup jalankan
`npm run dev`/app-nya, layar Login otomatis mendeteksi database masih kosong dan
menampilkan tombol **"Siapkan Database Sekarang"** (bootstrap tanpa perlu login dulu,
tapi cuma bisa dipakai SEKALI selagi database benar-benar virgin — lihat guard-nya di
`main/index.js` > `db:runInitialMigration` dan Khanza.md > "Bootstrap instalasi pertama").
`npm run migrate` dari CLI tetap tersedia sebagai opsi buat IT/automasi.

Di instalasi produksi (banyak PC), migrasi pertama ini cukup dilakukan **sekali** dari
satu PC — bukan per-PC. Migrasi-migrasi BERIKUTNYA (update rilis di masa depan) baru bisa lewat tombol "Jalankan
Migration" di Pengaturan, karena saat itu admin sudah bisa login.

Login default setelah migrasi: `admin` / `admin123` (dipaksa ganti password —
`must_change_password = true`, tapi UI ganti password belum dibuat, masih TODO).

### Linux: error FATAL sandbox saat `npm run dev`

Electron di Linux butuh `chrome-sandbox` dimiliki `root` dengan bit setuid.
Jalankan sekali (bukan spesifik project ini, semua app Electron butuh ini):

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

### Bypass Aktivasi Lisensi untuk dev lokal

Server lisensi Khanza belum ada, jadi `Aktivasi.vue` **otomatis di-skip kalau
`import.meta.env.DEV` true** (cuma jalan lewat `npm run dev`, TIDAK PERNAH di
build production). Hapus blok bypass ini di `views/base/Aktivasi.vue` begitu
server lisensi sungguhan sudah siap.

## Status implementasi (lihat checklist penuh di Khanza.md)

- [x] Fase 0 — Auth (roles, permissions, users, login, ganti password service)
- [x] Fase 1 (sebagian) — migration Parkir/Toko/Perpustakaan/Surat/IPSRS sudah
      ada & tervalidasi jalan di Postgres. **Parkir CRUD selesai penuh**:
      Jenis & Tarif + Kartu/Barcode (create/update/delete, validasi & auto-suggest
      kode 1:1 dengan `DlgParkirJenis.java`/`DlgParkirBarcode.java`, permission
      tulis di-gate server-side lewat `AuthService.requirePermission()`) —
      Toko/Perpustakaan/Surat/IPSRS masih halaman placeholder.
- [ ] Fase -1 — Aktivasi Lisensi: halaman `Aktivasi.vue` + `LisensiService.js`
      sudah ada strukturnya, TAPI `PUBLIC_KEY` & `LISENSI_BASE_URL` masih
      PLACEHOLDER — server lisensi Khanza sendiri belum dibangun.
- [ ] Fase 2–6 — semua masih halaman placeholder di sidebar (sengaja, biar
      navigasi lengkap bisa dites), belum ada logic/migration.

## Sumber kebenaran permission: `sik.sql`

`../SIMRS-Khanza/sik.sql` (`CREATE TABLE `user``, baris ±42130–43344) punya
**1211 kolom boolean**, satu kolom per hak akses — itu model permission
Khanza asli (flat, langsung di tabel user, tanpa role terpisah). Struktur kita
dinormalisasi (`roles`+`permissions`+`role_permissions`, lihat migration
001–004 & 017), TAPI **slug permission-nya WAJIB sama persis dengan nama
kolom asli itu** — lihat `src/main/db/reference/khanza-permissions-asli.txt`
(daftar lengkap 1211 nama) dan `017_seed_permissions_khanza_asli.js` (seed-nya).
`config/menu.js` sudah dikoreksi memakai nama-nama ini — beberapa masih ditandai
`TODO-permission` karena tidak ketemu padanan persis, jangan dianggap final.

## Temuan penting selama scaffolding (sudah dicatat juga di migration files)

- **Parkir**: `DlgParkirMasuk.java` asli TIDAK menyimpan transaksi apa pun ke
  DB — cuma lookup tarif lalu cetak karcis. Tidak ada tabel log masuk/keluar.
- **Toko**: ~~modul asli cuma 1 baris setting markup harga~~ **KOREKSI**: ini
  salah, saya cuma cek `DlgSetHargaToko.java` di `src/setting/` dan tidak
  sempat lihat `src/toko/` (33 file — sistem retail lengkap: suplier, barang,
  penjualan, member, piutang, retur, stok opname). Ketahuan pas cross-check
  ke `sik.sql` yang punya puluhan kolom `toko_*`. Migration `008_create_toko_setharga`
  masih valid (tabel itu memang ada), tapi cuma sebagian kecil dari modul
  sebenarnya — skema penuhnya belum di-migration.
- **Surat**: `SuratMasuk`/`SuratKeluar` & puluhan template surat klinis di
  Khanza asli pakai JavaFX WebView (compose surat), TIDAK menyentuh database
  sama sekali — beda arsitektur total dari form CRUD biasa, butuh investigasi
  terpisah sebelum didesain.

**Pelajaran dari temuan Toko**: jangan berhenti investigasi begitu nemu SATU
file yang namanya cocok — cek juga apakah ada folder/package dengan nama
modul itu sendiri (`src/toko/`, bukan cuma referensi ke "toko" dari file lain).
Cross-check ke `sik.sql` (daftar permission) adalah cara cepat mendeteksi kalau
sebuah modul ternyata lebih besar dari yang kelihatan dari nama file.

Sebelum menambah modul baru: **wajib ikuti SOP di Khanza.md** (baca kode Java
asli dulu, trace query SQL & logic bisnis, baru desain migration+IPC+UI).

## Pola CRUD modul — contoh: Parkir

Parkir (`src/main/db/modules/ParkirService.js`, `views/parkir/JenisTarif.vue` +
`KartuBarcode.vue` + `Masuk.vue`) jadi referensi pola buat modul CRUD berikutnya.
**Tampilan (modal vs tab, pagination) ikut Konvensi UI di Khanza.md** — jangan
didesain ulang dari nol tiap modul:

1. **Baca kode Java asli SAMPAI HABIS** (bukan cuma grep sepintas) — urutan
   validasi, field mana yang boleh diedit/di-rename, logic auto-suggest kode
   (`Valid.autoNomer`), semua ditelusuri dari situ, bukan ditebak.
2. **Service layer** (`ParkirService.js`) isinya query DB polos + validasi yang
   MENIRU URUTAN pengecekan Java asli — return `{ success, message }`, bukan
   throw, supaya UI bisa nampilin pesan yang sama persis.
3. **Tulis (create/update/delete) di-gate permission server-side** lewat
   `AuthService.requirePermission(token, 'slug_permission')` di IPC handler
   (`main/index.js`) — baca/list TIDAK di-gate tambahan (konsisten dengan
   Java asli yang cuma disable tombol, bukan proteksi per-query).
4. **Constraint DB (mis. `CHECK`) yang ketinggalan di migration pertama**
   ditambahkan lewat migration BARU (lihat `019_add_parkir_jenis_check.js`),
   bukan edit migration lama — sesuai prinsip di Khanza.md.
5. **Kalau ada layar asli yang TERNYATA bukan CRUD** (kayak `DlgParkirMasuk.java`
   yang cuma cetak karcis) — jangan dipaksa jadi CRUD, cukup kasih catatan di
   UI kenapa tab/menu itu tidak ada form-nya (lihat `views/parkir/Masuk.vue`).
6. **1 file Vue per route**, bukan 1 file besar dengan tab internal buat
   beberapa route — Jenis, Barcode, dan Masuk masing-masing file+route sendiri,
   meski sama-sama "modul Parkir", karena di Java asli juga 3 `Dlg` terpisah.
7. **List pakai `useServerTable` + `AppPagination`** (di-port dari pos-desktop,
   lihat `composables/`, `components/`) — fungsi list di service WAJIB terima
   `{page, pageSize, sortBy, sortOrder, search}` dan balikin `{data, total}`.
   `sortBy` di-whitelist lewat object lookup (`JENIS_SORTABLE`) sebelum masuk
   SQL, tidak pernah interpolasi langsung dari input user.
8. **Toast** (`useToast`/`AppToast`, sudah di-mount di `App.vue`) buat feedback
   sukses/gagal — bukan teks error statis di kartu form.
