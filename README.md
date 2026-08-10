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

## Setup

```bash
npm install
cp .env.example .env   # isi kredensial Postgres & JWT_SECRET yang sebenarnya
npm run migrate         # jalankan migration tanpa buka Electron (buat cek ke staging DB dulu)
npm run dev              # jalankan app
```

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
      ada & tervalidasi jalan di Postgres. **UI CRUD baru Parkir yang jalan
      beneran** (baca dari DB via IPC) — sisanya masih halaman placeholder.
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
