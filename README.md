# Khanza Desktop

Rewrite SIMRS Khanza (Java Swing, lihat `../SIMRS-Khanza`) ke Electron. **Baca
`../SIMRS-Khanza/Khanza.md` dulu sebelum mengerjakan modul apa pun** — dokumen
itu adalah rencana lengkap (mapping modul, urutan migrasi, SOP wajib, arsitektur
lisensi & UI). File ini cuma catatan teknis cara jalankan project.

## Beda dari referensi (`pos-desktop`)

Struktur folder & pola UI (sidebar, permission, komponen) mengikuti
`~/Documents/PRIBADI/Wails/POS_LISENSI/pos-desktop`, tapi:

> **PIVOT (membatalkan keputusan Postgres di bawah)** — backend pindah ke
> **MySQL**, connect ke database `sik` yang SAMA PERSIS dengan yang dipakai
> app Java, pakai skema `sik.sql` APA ADANYA untuk semua tabel bisnis
> (bukan lagi migration Postgres custom per modul). Lihat detail lengkap +
> alasan di `../SIMRS-Khanza/Khanza.md` > "Prinsip Migrasi Data". Ringkasnya:
> - Driver `pg` → `mysql2`. Tidak ada lagi ETL/cutover dua-mesin-DB — Electron
>   & Java baca/tulis tabel yang sama secara real-time sejak modul itu digarap.
> - Migration business-data yang sudah ditulis untuk Postgres (023 Toko, 024
>   kodesatuan, 006–022 Parkir/Perpustakaan/Surat/IPSRS) **dibuang** — tabelnya
>   sudah ada 1:1 di `sik.sql` (sudah diverifikasi table-existence check).
> - Auth/permission TETAP ternormalisasi (`electron_roles/permissions/
>   role_permissions/user_roles`, prefix `electron_`), tapi **tanpa
>   `electron_users`** — login pakai tabel `admin`/`user` ASLI langsung (lihat
>   "Login & Permission (pivot MySQL)" di bawah untuk mekanisme lengkap).

- ~~**Postgres**, bukan SQLite — dan dipakai **untuk semua modul sejak awal**~~
  **(DIBATALKAN, lihat pivot di atas)**. Konsekuensi lama yang juga batal:
  modul yang masih dipakai bareng app Java tidak lagi butuh strategi
  ETL/cutover — sekarang share tabel MySQL yang sama, real-time.
- **Tidak ada Express/backend server terpisah.** Tiap komputer klien connect
  langsung ke MySQL `sik` pusat lewat koneksi di main process (`mysql2`
  Pool), di-expose ke renderer lewat IPC (`ipcMain.handle` + `contextBridge`),
  bukan HTTP/axios ke `localhost:<port>`.
- Migration pakai runner custom (numbered files, tabel `electron_migrations`)
  — pola sama seperti referensi, cuma ganti `better-sqlite3` → `mysql2`.
  **TIDAK ADA backup otomatis** dari app ini (keputusan sengaja — `mysqldump`
  tidak selalu tersedia di tiap komputer klien, dan backup database `sik`
  sudah rutin di sisi server/DBA) — UI (Pengaturan > Database, Migrasi &
  Pembanding Skema) menegaskan lewat konfirmasi eksplisit bahwa backup
  manual WAJIB sudah dilakukan sebelum menjalankan aksi yang ubah skema.
- **Migration TIDAK auto-run saat app start** (beda dari referensi) — app ini
  di-install di banyak PC RS sekaligus ke satu MySQL pusat, auto-migrate
  tiap boot berisiko race condition. Migration cuma bisa dipicu manual oleh
  **Administrator** lewat tombol di Pengaturan (role dicek ulang di IPC
  handler, bukan cuma disembunyikan di UI) atau `npm run migrate` dari CLI.

## Login & Permission (pivot MySQL)

Tidak ada tabel `electron_users` — akun tetap satu sumber (tabel asli Khanza),
cuma lapisan role/permission-nya baru:

| Kebutuhan | Sumber |
|---|---|
| Login **Admin Utama** | Tabel `admin` asli (`usere`/`passworde`, `AES_ENCRYPT` key `'nur'`/`'windi'` — sama persis `src/fungsi/akses.java`). Cocok → akses penuh **hardcode**, skip pengecekan role/permission sama sekali (persis kelakuan Java). |
| Login **user biasa** | Tabel `user` asli (`id_user`/`password`, `AES_ENCRYPT` sama). Cocok → role dicari di `electron_user_roles`. |
| Role | `electron_roles` |
| Daftar permission (1211 slug asli + slug baru Electron) | `electron_permissions` (seed dari `017_seed_permissions_khanza_asli.js` + `018_seed_permissions_electron_extra.js`) |
| Role ↔ permission | `electron_role_permissions` |
| User ↔ role | `electron_user_roles` (`id_user` VARCHAR(700) — **tidak ada FK formal** ke `user.id_user`, tabel `user` bermesin MyISAM yang tidak mendukung FOREIGN KEY sama sekali; divalidasi di level aplikasi) |

**Penting**: nilai 1211 kolom boolean individual di tiap baris `user` asli
**tidak pernah dibaca** sebagai sumber otorisasi Electron — cuma dipakai
SEKALI sebagai daftar nama slug. Semua cek izin di Electron 100% role-based
lewat `electron_role_permissions`. Konsekuensi: toggle permission individual
di app Java untuk 1 staff tertentu TIDAK otomatis kebawa ke Electron — dua
sistem independen sejak titik ini.

**Bootstrap akun pertama tidak perlu wizard khusus** (beda dari rencana lama
Postgres) — akun `admin` (Admin Utama) sudah ADA di data real `sik.sql`
sejak awal, aksesnya hardcode penuh tanpa bergantung tabel `electron_*` apa
pun. Login normal lewat layar Login biasa, lalu jalankan migration
`electron_*` (kalau belum) dari Pengaturan seperti alur admin biasa.

**Pengaturan → Database → Pembanding Skema: SELESAI.** Upload `sik.sql`
versi baru (native file dialog di main process, isi file tidak pernah lewat
IPC), dibandingkan ke `information_schema` MySQL yang berjalan (parser regex
`CREATE TABLE`, bukan full SQL parser — cukup buat format mysqldump standar).
Deteksi tabel baru/kolom baru (ada tombol "Terapkan" per item, WAJIB
konfirmasi eksplisit "backup sudah dilakukan manual" dulu — tidak ada backup
otomatis, lihat "Beda dari referensi" di atas) dan kolom berubah tipe/tabel-
kolom hilang (info doang, TIDAK PERNAH ditawarkan tombol apply — risiko data
loss). Kolom baru di tabel `user` otomatis diusulkan jadi slug baru di
`electron_permissions`. **Temuan penting saat validasi** (dites lawan
`sik.sql` asli vs database live — harus 0 beda):
- MySQL 8.0.19+ tidak lagi melaporkan display-width kolom `int`/`year` lewat
  `information_schema` (`int(11)` di dump balik jadi cuma `int`) meski
  kolomnya beneran dibuat dengan width itu — tanpa normalisasi ini, RATUSAN
  kolom salah terdeteksi "berubah tipe" padahal sama persis (702 false
  positive sebelum fix).
- Parsing `DEFAULT` yang isinya string literal WAJIB ikut aturan escaping
  MySQL (`''` = 1 literal quote, BUKAN backslash) — dump asli punya kolom
  dgn `DEFAULT ''''''`, regex naive salah berhenti di kutip pertama.

**Sinkronisasi Permission (terpisah dari diff skema)**: diff skema di atas
cuma bandingkan kolom FILE vs LIVE — kalau slug di `electron_permissions`
kehapus manual (bukan kolom `user`-nya yang hilang), diff skema tidak akan
mendeteksi apa-apa (kolomnya memang tidak berubah). Ditambahkan pengecekan
terpisah `getMissingPermissions()`: bandingkan kolom `user` LIVE langsung ke
isi `electron_permissions`, independen dari upload file — jalan otomatis
begitu tab dibuka + tombol "Cek Ulang" manual. Tervalidasi: hapus slug `igd`
manual dari `electron_permissions` → terdeteksi sebagai "belum punya
permission" → tombol Tambahkan mengembalikannya.

## Setup

```bash
npm install
cp .env.example .env   # isi kredensial MySQL (host/port/user/pass/database=sik) & JWT_SECRET
npm run migrate         # jalankan migration electron_* (roles/permissions/role_permissions/user_roles)
npm run dev              # jalankan app
```

Tidak perlu wizard bootstrap tanpa-login — akun `admin` (Admin Utama) sudah
ADA di data `sik.sql` sejak awal, akses penuh hardcode tanpa bergantung
migration `electron_*` sudah jalan atau belum. Login pakai akun `admin` itu
langsung, lalu (kalau migration `electron_*` belum jalan) jalankan lewat
tombol "Jalankan Migration" di Pengaturan atau `npm run migrate` dari CLI.

Di instalasi produksi (banyak PC), migrasi cukup dilakukan **sekali** dari
satu PC — bukan per-PC.

Login: pakai akun `admin`/`user` yang SUDAH ADA di `sik.sql` Anda (lihat
"Login & Permission" di atas) — bukan seed `admin`/`admin123` baru.

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

> **Pivot Postgres → MySQL SEDANG BERJALAN** (lihat "Beda dari referensi" &
> "Login & Permission" di atas). Fase 0 (Auth) **sudah pindah & tervalidasi
> di MySQL asli** (database `sik` sungguhan, bukan cuma konsep). Modul Fase 1
> (Parkir/Toko/dkk) MASIH tervalidasi di Postgres lama — service layer-nya
> belum disesuaikan ke skema `sik.sql` asli, jadi IPC `toko:*`/`satuan:*`
> (34 handler) akan ERROR sampai itu dikerjakan (langkah berikutnya setelah
> Kelola Role).

- [x] Fase 0 — Auth: **jalan di MySQL, tervalidasi ke database `sik` asli**
      — migration `electron_roles/permissions/role_permissions/user_roles`
      (6 migration, 1213 permission slug ter-seed), `AuthService.js` login
      ke tabel `admin`/`user` ASLI (AES_ENCRYPT 'nur'/'windi', persis Java),
      role "Admin Utama" (tabel `admin`) dapat akses penuh hardcode, role
      "Administrator" (electron_roles) dapat semua permission juga. Test
      end-to-end: login admin utama ✓, login user tanpa role ditolak ✓, login
      user setelah di-assign role ✓, password salah ditolak ✓. **Kelola
      Role/User SELESAI**: `RoleService.js` (CRUD role, set permission
      per-role, assign/cabut role ke akun `user` asli — validasi akun
      beneran ada di tabel `user` sebelum di-assign, karena tabel itu
      MyISAM/tanpa FK), UI `ManajemenUser.vue` (tab Role: nama + checklist
      1213 permission dgn search; tab User: daftar akun asli ter-dekripsi +
      pilih role per akun) di `/pengaturan/user`. Semua IPC di-gate
      `isFullAdmin` (Admin Utama/Administrator saja — replika "kelola user
      cuma Admin Utama" di Java). Tervalidasi ke database `sik` asli: assign
      ke akun tidak ada ditolak ✓, hapus role yang masih dipakai ditolak ✓.
- [x] **Toko — service layer SELESAI disesuaikan ke MySQL + skema `sik.sql`
      asli** (`TokoJenisService.js`, `TokoSuplierService.js`,
      `TokoMemberService.js`, `SatuanService.js`, `TokoBarangService.js`,
      `TokoOpnameService.js`). Perbedaan skema asli vs asumsi Postgres lama
      yang ketahuan & diperbaiki:
      - `tokobarang.status` char enum('0','1') — BUKAN kolom `aktif BOOLEAN`
        hasil migration Postgres yang sudah dibuang. `'1'`=aktif, `'0'`=sampah
        (dikonfirmasi `src/toko/TokoBarang.java` & `DlgRestoreTokoBarang.java`).
      - Tabel harga jual namanya `tokosetharga` (TANPA underscore) — beda dari
        `toko_setharga` yang saya asumsikan sebelumnya — dan tabel ini MyISAM
        TANPA kolom `id`/PK sama sekali (cuma 1 baris, pola Java "delete
        semua lalu insert 1 baris baru"), jadi query-nya `LIMIT 1` tanpa WHERE.
      - `tokoopname` PK KOMPOSIT `(kode_brng, tanggal)`, kolom persis
        `kode_brng, dasar, tanggal, stok, real, selisih, nomihilang,
        keterangan` (urutan INSERT dikonfirmasi positional dari
        `TokoInputStok.java`). `real` itu KATA KUNCI RESERVED MySQL, wajib
        di-backtick tiap dipakai sebagai nama kolom.
      - `toko_riwayat_barang` KHUSUS posisi='Opname': `masuk`=nilai Real
        (bukan kuantitas barang masuk beneran) DAN `stok_akhir`=nilai Real
        juga (bukan `stok_awal+masuk-keluar` seperti posisi transaksi lain) —
        dikonfirmasi dari `riwayattoko.catatRiwayat()`, field ditumpangi
        maknanya karena tabel ini dipakai bareng banyak jenis transaksi.
      - Logic bisnis (formula selisih/nomihilang, alur batch-transaksi) hasil
        audit adversarial sebelumnya **sudah benar**, tidak perlu diulang —
        cuma dialect+skema yang perlu disesuaikan.
      - **Bug nyata ketemu & diperbaiki**: `nextKode()` di `TokoBarangService`/
        `TokoMemberService` pakai `MAX(CAST(...AS UNSIGNED))` — mysql2
        BALIKIN HASIL CAST INI SEBAGAI STRING (beda dari `COUNT(*)` biasa
        yang balik number), jadi `mx + 1` di JS jadi CONCAT STRING
        ("2"+1="21") bukan penjumlahan. Ketahuan lewat test nyata: kode
        barang baru nyeleneh (BT000021 → BT000211 → BT002111, makin panjang
        tiap dipanggil). Fix: `Number(mx) + 1`. **Pola ini perlu diingat
        untuk service Postgres lain yang belum disentuh** (Perpustakaan*,
        SuratMasukKeluarService — sama-sama pakai `MAX(CAST(...AS UNSIGNED))`
        buat `nextKode()`, belum diverifikasi ke MySQL).
      Tervalidasi penuh ke database `sik` asli (create/list/update/delete,
      soft-delete+restore+hardDelete, calcHarga pakai data real tokosetharga,
      batch opname 3 barang dgn skenario kurang/lebih/pas, rollback-semua saat
      1 item bentrok, riwayat ter-record dgn mapping khusus Opname) — semua
      data test dibersihkan lagi setelahnya.
- [x] **Parkir, Surat, Perpustakaan — service layer SELESAI disesuaikan ke
      MySQL + skema `sik.sql` asli** (9 file: `ParkirService.js`,
      `SuratTaksonomiService.js`, `SuratMasukKeluarService.js`, dan 8 file
      `Perpustakaan*Service.js`). Temuan skema & bug nyata:
      - `perpustakaan_set_peminjaman` (pengaturan peminjaman) & konsep serupa
        di Toko (`tokosetharga`) TANPA kolom `id`/PK sama sekali — pola
        Postgres lama (`id SMALLINT PK` + `ON CONFLICT`) tidak berlaku,
        `PerpustakaanPengaturanService.upsert()` ditulis ulang jadi
        transaksi DELETE-ALL-lalu-INSERT (kembali ke pola Java asli
        sesungguhnya, MySQL `ON DUPLICATE KEY UPDATE` butuh unique key yang
        memang tidak ada di tabel ini).
      - `perpustakaan_peminjaman` TANPA PK/UNIQUE constraint apa pun (cuma
        index biasa) — beda dari asumsi sebelumnya, jadi pengecekan
        `ER_DUP_ENTRY` di situ jadi jaring pengaman yang kemungkinan besar
        tidak pernah kepicu (bukan satu-satunya proteksi terhadap duplikat).
      - Bug `nextKode()` MAX-based (mysql2 balikin `CAST(...AS UNSIGNED)`
        sebagai string, lihat temuan di Toko) ternyata ADA JUGA di
        `PerpustakaanPenerbitService`/`KoleksiService`/`InventarisService`/
        `AnggotaService` dan `SuratMasukKeluarService.nextNoUrut()` — kelima-
        limanya sudah diperbaiki (`Number(mx)`), bukan cuma di Toko.
      - **Insiden testing (jangan diulang)**: `perpustakaan_set_peminjaman`
        ternyata SUDAH ADA data produksi asli (`max_pinjam:2, lama_pinjam:7,
        denda_perhari:1000`) sebelum test `Pengaturan.upsert()` dijalankan —
        karena upsert-nya delete-all-lalu-insert, data asli itu KETIMPA data
        test. Ketahuan & langsung dikembalikan ke nilai asli setelah test.
        **Pelajaran**: WAJIB `SELECT` isi tabel dulu sebelum testing apa pun
        yang sifatnya delete-all/single-row-config, jangan asumsikan kosong.
      - **Bug nyata ketemu dari testing user (sudah diperbaiki)**: field
        "Petugas" (`nip`) di Sirkulasi sempat di-auto-isi dari
        `auth.user.username` (siapa yang login) — kelihatan benar untuk staf
        biasa (`id_user` sering kebetulan = `nip` asli), tapi Admin Utama
        (tabel `admin`, username bebas mis. `spv`) BUKAN `nip` valid di tabel
        `petugas`, jadi `perpustakaan_peminjaman_ibfk_3` gagal FK. Re-baca
        `PerpustakaanSirkulasi.java`: Java asli pakai dialog terpisah
        `kepegawaian.DlgCariPetugas` (pilih petugas AKTIF, independen dari
        akun yang login — satu meja sirkulasi bisa dipakai bergantian).
        Fix: `nip` sekarang dropdown eksplisit (`listPetugas()`,
        `WHERE status='1'`) di form pinjam/kembali/perpanjang, IPC handler
        tidak lagi menimpa `nip` dari session. Tervalidasi ulang end-to-end
        (pinjam dgn nip tidak valid tetap ditolak FK, dgn nip valid dari
        dropdown berhasil di ketiga alur), data test dikembalikan persis.
      - **Bug nyata ke-2 (sudah diperbaiki)**: `previewKembali()`/`kembali()`
        identifikasi baris pinjaman cuma pakai `no_anggota+no_inventaris+
        tgl_pinjam` — tabel `perpustakaan_peminjaman` TANPA PK/UNIQUE, jadi
        kombinasi itu BISA duplikat kalau buku yang sama dipinjam-kembalikan-
        dipinjam lagi oleh anggota yang sama di hari yang sama (2+ baris
        dgn 3 kolom identik). Query tanpa filter tambahan bisa salah tangkap
        baris LAMA yang sudah dikembalikan, lalu menolak dgn pesan "sudah
        pernah dikembalikan" padahal baris AKTIF-nya masih ada — dilaporkan
        user lewat testing nyata. Cek Java asli (`PerpustakaanSirkulasi.java`
        baris ~1048): ternyata validasi ini TIDAK ADA sama sekali di Java
        (murni tambahan di rewrite ini). Fix: tambah `AND status_pinjam=
        'Masih Dipinjam'` di WHERE — aman krn `pinjam()` menjamin maks 1
        baris "Masih Dipinjam" per `no_inventaris`. Tervalidasi ulang dgn
        skenario duplikat nyata (2 baris sama persis, salah satu sudah
        kembali), data test dibersihkan.
      Semua tervalidasi end-to-end ke database `sik` asli (termasuk alur
      pinjam→kembali dengan preview denda keterlambatan yang match hitungan
      manual, dan bayar denda 2-tabel terpisah) — data test dibersihkan.

      Detail modul (riwayat sebelum pivot, fitur-fiturnya tidak berubah):
      - Parkir: Jenis & Tarif + Kartu/Barcode (`DlgParkirJenis.java`/`DlgParkirBarcode.java`)
      - Surat: 9 taksonomi arsip fisik identik (Rak/Almari/Klasifikasi/Sifat/
        Map/Indeks/Ruang/Status/Balas) lewat **1 service generik**
        (`SuratTaksonomiService.js`) + **1 komponen Vue generik** (`TaksonomiTab.vue`)
        dipakai ulang 9x via prop — bukan file copy-paste. **`SuratMasuk`/
        `SuratKeluar` SEKARANG SELESAI JUGA** (`SuratMasukKeluarService.js` +
        `MasukKeluarTab.vue`) — modul PERTAMA hasil porting dari pola hybrid
        webview (PHP `webapps/surat/pages/{input,input2,list,list2}.php`) ke
        native, lihat "Arsitektur Hybrid WebView" di Khanza.md. File lampiran
        (WAJIB di aslinya) disimpan ke **MinIO** (`MinioService.js`) —
        implementasi pertama dari keputusan MinIO yang sebelumnya cuma
        rencana. Cuma Create+List+Delete, TIDAK ADA Edit (replikasi apa
        adanya, memang begitu di aslinya).
      - Perpustakaan: 7 halaman — Master Data (5 sub-taksonomi + Penerbit dalam
        1 halaman ber-tab), Koleksi (katalog buku, FK ke 4 master data),
        Anggota, Inventaris (eksemplar fisik + summary nilai total), Sirkulasi
        (pinjam/kembali/perpanjang dengan preview jatuh-tempo & denda live),
        Denda (taksonomi % + BayarDenda 2-tabel terpisah), Pengaturan
        Peminjaman (config 1 baris). 3 file WebView (`PerpustakaanCariEbook/
        Ebook/Penelitian`) TIDAK digarap.
      - **Toko: Master Data + Stok Opname selesai** (investigasi 33 file
        selesai — TERNYATA POS lengkap, tapi hampir semua transaksi
        (`TokoPenjualan`/`Pembelian`/`Pemesanan`/`Piutang`/`Retur*`) otomatis
        posting jurnal ke Keuangan yang belum dibangun → **SENGAJA DITUNDA ke
        Fase 3**, keputusan eksplisit biar tidak ada bagian setengah-jadi yang
        diam-diam skip akuntansi). Yang digarap: Jenis Barang, Barang (soft-
        delete + "Data Sampah" khusus role Administrator, ADA 2 aksi di sana:
        Restore & **Hapus Permanen** — replika `src/restore/DlgRestoreTokoBarang.java`
        yang punya `BtnSimpan`("Restore")+`BtnHapus`("Hapus", DELETE beneran)
        + auto-hitung harga jual dari `toko_setharga`), Suplier, Member, Stok Opname (input +
        riwayat, overwrite stok, TIDAK sentuh jurnal), Riwayat Barang
        (viewer read-only), dan **Satuan** (`SatuanService.js`, tabel shared
        `kodesatuan` dari `src/inventory/DlgSatuan.java` — FK sungguhan dari
        `TokoBarang.kode_sat`, BUKAN teks bebas seperti sempat direncanakan;
        lihat "Temuan penting" di bawah).

      Semua: create/update/delete, validasi & auto-suggest kode 1:1 dengan
      Java asli, permission tulis di-gate server-side lewat
      `AuthService.requirePermission()`, list pakai `useServerTable`+`AppPagination`
      (Konvensi UI di Khanza.md) — Toko/IPSRS masih placeholder (IPSRS ternyata
      41 file, jauh lebih besar dari dokumentasi awal — cek ulang sebelum digarap).
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
  sama sekali — TIDAK digarap. Yang beneran CRUD cuma 9 taksonomi arsip fisik
  (Rak/Almari/Klasifikasi/Sifat/Map/Indeks/Ruang/Status/Balas) — 3 di antaranya
  (Ruang, Status, Balas) KELEWAT di migration awal (014), baru ketahuan pas
  cek index folder `src/surat/` lebih teliti — ditambahkan lewat migration 020.
  Ada juga mismatch penamaan: permission `surat_almari` (dari `SuratAlmari.java`)
  ternyata query ke tabel `surat_lemari`, bukan `surat_almari`.
- **Perpustakaan**: migration `009`–`013` ditulis SEBELUM investigasi mendalam
  (baru baca isi lengkap 13 file Java, bukan tebak dari nama field UI) —
  ketahuan beberapa mismatch: `perpustakaan_kategori.kode_kategori` seharusnya
  `id_kategori`, `perpustakaan_jenis_buku.nm_jenis` seharusnya `nama_jenis`,
  `perpustakaan_penerbit` kurang 3 kolom kontak (no_telp/email/website),
  `perpustakaan_set_peminjaman` kurang 2 kolom PENTING (`max_pinjam`/
  `lama_pinjam` — dipakai validasi batas pinjam & hitung jatuh tempo), dan
  `perpustakaan_bayar_denda` salah bentuk TOTAL (migration awal nebak 1 tabel
  gabungan tanpa `no_anggota`, padahal aslinya 2 tabel terpisah lewat 2 tab di
  dialog yang sama). Semua diperbaiki lewat migration baru `021_fix_perpustakaan_schema.js`
  (bukan edit migration 009-013 langsung — migration yang sudah applied tidak
  boleh diubah).

**Pelajaran dari temuan Toko & Surat**: jangan berhenti investigasi begitu
nemu SATU/BEBERAPA file yang namanya cocok — selalu cek index LENGKAP folder
modulnya (`ls src/<modul>/`), bukan cuma yang "kelihatan jelas" dari grep
awal. Cross-check ke `sik.sql` (daftar permission) adalah cara cepat
mendeteksi kalau sebuah modul ternyata lebih besar dari yang kelihatan.

- **Kolom `DATE` balik sebagai objek JS `Date`, bukan string** (ditemukan saat
  uji manual Perpustakaan → Anggota, error `row.tgl_lahir?.slice is not a
  function` pas buka modal Edit): driver `pg` secara default parsing tipe
  Postgres `DATE` (OID 1082) jadi `Date`, padahal semua kode renderer (Vue)
  ditulis dengan asumsi string `'YYYY-MM-DD'` (dipakai langsung di
  `<input type="date">` v-model, `.slice(0,10)`, dst). **Sudah diperbaiki di
  SATU tempat** — `DatabaseService.js` sekarang override type parser-nya
  (`types.setTypeParser(1082, val => val)`) supaya `DATE` selalu balik
  sebagai string mentah dari Postgres, bukan di-parse jadi `Date`. Ini
  berlaku global (semua query lewat pool yang sama), jadi modul manapun yang
  nanti punya kolom `DATE` otomatis aman, tidak perlu ditambal manual per
  komponen. **Kolom `TIMESTAMP`/`TIMESTAMPTZ` TIDAK disentuh** (tetap balik
  `Date`, memang lebih berguna untuk audit timestamp) — cuma `DATE` murni.

- **Surat Masuk/Keluar** (`webapps/surat/pages/input.php`/`list.php`): kolom
  DB aslinya `file_url`, BUKAN `dokumen` — `$dokumen` cuma nama variabel PHP,
  ketahuan dari `SELECT` di `list.php` yang pakai nama `file_url` (INSERT-nya
  positional, `INSERT INTO tabel VALUES(...)`, jadi nama variabel PHP tidak
  mencerminkan nama kolom DB — WAJIB cross-check ke query SELECT, jangan
  percaya nama variabel INSERT begitu saja). Kuirk lain: field "Nomor Masuk/
  Keluar" di form KELIHATAN editable (text input, ada `required` & pattern
  regex) TAPI nilai yang disubmit user **tidak pernah dibaca** — PHP selalu
  recompute `no_urut` dari tanggal terima/kirim yang dipilih user saat itu
  juga. Direplikasi apa adanya di `SuratMasukKeluarService.create()` (server
  selalu hitung ulang, form cuma preview) — bukan kelalaian port, itu emang
  begitu di PHP-nya.

- **Toko**: investigasi 33 file `src/toko/` ketahuan ini POS lengkap
  (TokoPenjualan = header+detail, hitung PPN/ongkir/kembalian; TokoPemesanan
  beda dari TokoPembelian — Pemesanan itu penerimaan barang dgn HUTANG
  dagang, bukan sekadar "pesanan"), dan HAMPIR SEMUA transaksinya nulis
  jurnal ke `tampjurnal`/Keuangan. Karena Keuangan (Fase 3) belum dibangun,
  **modul transaksi (Penjualan/Pembelian/Pemesanan/Piutang/Retur*) SENGAJA
  DITUNDA** — cuma Master Data + Stok Opname yang digarap (dua-duanya
  dikonfirmasi TIDAK sentuh jurnal sama sekali). Jangan asumsikan "Toko
  selesai" dari nama menu-nya — cek Status di atas buat tahu persis bagian
  mana yang beneran jalan.
- **Kesalahan proses (penting, jangan diulang)**: field "Satuan" di
  `TokoBarang` awalnya mau dibuat teks bebas (bukan FK) dengan alasan
  "tabel `kodesatuan` ada di `src/inventory/` yang besar & belum
  diinvestigasi". User menegur ini — proyek ini REWRITE 1:1, bukan MVP,
  jadi tidak boleh ada penyederhanaan sepihak tanpa cek dulu. Setelah
  diinvestigasi, `kodesatuan` (dikelola `src/inventory/DlgSatuan.java`,
  permission `satuan_barang`) ternyata cuma 2 kolom (`kode_sat`, `satuan`)
  — kecil & gampang dibangun penuh, langsung diperbaiki jadi FK sungguhan
  (migration `024_create_kodesatuan.js`, `SatuanService.js`, service &
  namespace IPC-nya SENGAJA netral/tidak di-prefix "toko" karena tabel ini
  shared lintas modul Java asli). **Pelajaran**: sebelum defer/sederhanakan
  field yang merujuk ke modul/package lain yang belum digarap, WAJIB cek
  dulu ukuran & kompleksitas tabelnya (grep file Java yang kelola tabel
  itu) — kalau kecil, bangun saja; jangan asumsikan "besar" dari nama
  package induknya. **Follow-up bug**: migration `024` awalnya langsung
  `ADD CONSTRAINT ... FOREIGN KEY` tanpa backfill — gagal di database yang
  sudah kepakai (`tokobarang.kode_sat` sudah ada isinya sebelum FK ini
  ditambahkan, mis. "PCS"/"BOX" hasil input manual sebelum tabel
  `kodesatuan` ada). Diperbaiki dengan INSERT backfill
  (`kode_sat`+`satuan` = nilai lama apa adanya, `ON CONFLICT DO NOTHING`)
  SEBELUM `ADD CONSTRAINT` — **pola umum ini berlaku tiap kali nambah FK ke
  kolom yang sebelumnya teks bebas & sudah ada isinya**, bukan cuma kasus
  ini.
- **Bug kecil tapi jebakan**: JANGAN taruh karakter backtick (`` ` ``) di
  dalam komentar SQL (`-- ...`) yang ada di dalam template literal JS
  (`` await client.query(`...`) ``) — backtick itu MENUTUP template literal
  JS-nya secara prematur meski posisinya "di dalam" komentar SQL, bikin
  `SyntaxError: missing ) after argument list` yang membingungkan (errornya
  nunjuk ke baris `client.query(` di awal, bukan ke baris backtick yang
  sebenarnya salah). Ketahuan pas nulis migration `023_create_toko_master.js`
  (komentar SQL nulis `` `aktif` `` dan `` `status` ``) — kalau perlu
  highlight nama kolom di komentar SQL, pakai huruf besar/quote biasa, bukan
  backtick Markdown.

- **Audit adversarial ke-2 nemu 2 gap serius lagi di Stok Opname, SETELAH modul diumumkan "selesai"**:
  1. **Alur kerja salah total** — `TokoInputStok.java` itu BATCH (1 layar nampilin SEMUA barang aktif, isi kolom "Real" utk banyak baris, SATU tombol Simpan proses SEMUA baris terisi dalam SATU transaksi + dialog konfirmasi), versi awal cuma bisa 1 barang per submit.
  2. **Logic kalkulasi salah arah** — `selisih`/`nomihilang` itu OTOMATIS dihitung server (`kurang = stok_sistem - real`; `selisih = kurang>0 ? kurang : 0` — CUMA catat kekurangan, gapernah negatif; `nomihilang = kurang>0 ? kurang*dasar : 0`), versi awal jadikan `nomihilang` input manual & `selisih` bisa negatif.

  Diperbaiki total: `TokoOpnameService.createOpnameBatch()` (transaksi
  all-or-nothing — satu item bentrok, SEMUA di-rollback, replika persis
  `sukses`/`RollBack()` Java) + `Opname.vue` (tabel batch-entry, kolom
  Selisih/Nomi Hilang read-only ter-hitung live per baris). **User
  menegaskan instruksi standing**: *"lain kali saat mengerjakan fitur lain
  saya mau 1:1 meski pelan tidak masalah"* — WAJIB audit adversarial (baca
  ulang Java baris-per-baris vs kode yang dibangun) sebelum modul apapun
  ditandai selesai, jangan cuma percaya ringkasan investigasi awal.

Sebelum menambah modul baru: **wajib ikuti SOP di Khanza.md** (baca kode Java
asli dulu, trace query SQL & logic bisnis, baru desain migration+IPC+UI,
lalu audit adversarial sebelum ditandai selesai — lihat poin 7 di SOP).

## File lampiran (MinIO): `main/electron/MinioService.js`

Pengganti folder `webapps/<modul>/pages/upload/` milik PHP di Khanza asli
(lihat Khanza.md > "Arsitektur Hybrid WebView"). Dipegang HANYA main process
(pola sama `DatabaseService.js`) — renderer TIDAK pernah connect langsung ke
MinIO, cuma lewat IPC `file:upload`/`file:getUrl`. Postgres cuma nyimpan
**object key**-nya (bukan URL permanen/`bytea`) — presigned URL (berumur
pendek) di-generate on-demand tiap kali dibutuhkan.

Konfigurasi lewat `.env` (`MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY/
USE_SSL/BUCKET`, default instalasi lokal standar — `localhost:9000`,
`minioadmin`/`minioadmin`, bucket `khanza`). Alur upload dari renderer:
baca file jadi `ArrayBuffer` (`File.arrayBuffer()`) dulu sebelum di-`invoke`
(JANGAN kirim `File` object langsung — structured-clone Electron tidak
reliable buat itu), generate `objectKey` unik (pola: `<modul>/<jenis>/
<timestamp>-<namafile>`), baru panggil `create()` record-nya dengan
`file_url: objectKey`. Saat record dihapus, `deleteOne()` di service hapus
file MinIO DULU baru row DB (replikasi urutan `unlink()` lalu `Hapus()` di
PHP asli) — kalau hapus file gagal (mis. sudah kehapus manual), tetap lanjut
hapus row, tidak menghentikan proses.

## Dropdown pencarian (gaya Select2): `components/AppSelect.vue`

Buat field FK/referensi yang datanya bisa panjang (pilih Anggota, Buku,
Penerbit, dst — lihat Perpustakaan) — bukan `<select>` native. Dibungkus dari
`@vueform/multiselect` (Vue-native, BUKAN Select2 asli yang jQuery — sengaja
dihindari karena bentrok sama Virtual DOM Vue). Tema warnanya dipetakan ke
token daisyUI (`--color-*`) di `style.css`, otomatis ikut tema aktif.

Pakai `AppSelect` HANYA untuk data referensi yang bisa banyak (master data,
FK ke tabel lain). Untuk enum kecil TETAP (2–5 opsi tetap, mis. Jenis Kelamin,
Sistem Harian/Jam, Asal Buku) — pakai `<select>` native biasa, search tidak
menambah manfaat di situ. Props: `options` (array of object, WAJIB, nama
field kode/labelnya beda-beda per tabel — jangan diseragamkan paksa),
`value-prop` (nama field kode), `label` (nama field yang ditampilkan). Kalau
label butuh gabungan beberapa field (mis. "Judul (No.Inventaris)"), bikin
`computed` yang nambahin field string baru (lihat `opsiInventarisPinjam` di
`Sirkulasi.vue`) — jangan taruh template expression di prop `label`.

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
9. **Kalau satu modul punya BANYAK layar yang CRUD-nya identik** (cuma beda
   nama tabel/kolom — lihat contoh Surat: 9 taksonomi arsip fisik sama persis)
   — buat **SATU service generik** diparameterkan (`SuratTaksonomiService.js`,
   whitelist `jenis` → `{table, kolom, prefix, permission}`) dan **SATU
   komponen Vue generik** (`TaksonomiTab.vue`) dipakai ulang lewat prop +
   `:key` biar remount bersih tiap ganti jenis — JANGAN copy-paste N file
   yang isinya sama. Halaman induknya (`Surat.vue`) tinggal daftar tab yang
   memilih `jenis` mana yang aktif.
