// Sumber: Khanza.md > "Referensi menu.js — Mapping 32 Modul". Kalau mapping di
// sana direvisi lagi, salin ulang ke sini (atau sebaliknya) — jangan biarkan
// dua versi ini berbeda tanpa disadari.
import {
  LayoutGrid, ClipboardList, Siren, Stethoscope, BedDouble, DoorOpen, List,
  Scissors, CalendarPlus, Pill, FlaskConical, FileText, Microscope, Radiation,
  Gauge, Factory, ArrowLeftRight, Utensils, Droplet, FolderOpen, RefreshCcw,
  Archive, CheckSquare, Wallet, Monitor, Lock, PiggyBank, FileWarning,
  BarChart2, BookText, TrendingUp, Landmark, ShoppingBag, ParkingSquare,
  CarFront, Tag, Users, CalendarCheck, CalendarDays, History, Boxes, Package,
  AlertTriangle, Wrench, BookOpen, Mail, ShieldCheck, ClipboardCheck, HardHat,
  Building2, FileBarChart, Activity, HandHeart, LineChart, MessageSquare,
  Link2, IdCard, FileCheck2, ListTree, Settings, Bookmark,
  Shield, Briefcase, AlertOctagon, CreditCard, NotebookPen,
  Tags, UserCircle, Repeat, Coins, SlidersHorizontal,
} from 'lucide-vue-next'

// PERMISSION SLUG SEKARANG = NAMA KOLOM ASLI di sik.sql > CREATE TABLE `user`
// (1211 kolom, lihat src/main/db/reference/khanza-permissions-asli.txt & migration
// 017_seed_permissions_khanza_asli.js). Ini KEPUTUSAN SADAR: struktur tabel kita
// dinormalisasi (roles + permissions + role_permissions, bukan 1211 kolom
// boolean di tabel user), TAPI penamaan slug tetap 1:1 ke kolom asli — supaya
// tetap bisa ditelusuri balik ke fitur Java aslinya dan gampang kalau nanti
// perlu migrasi hak akses user lama.
//
// Realita penting dari sik.sql: banyak "modul" di sisi kita itu di Khanza asli
// dipecah jadi PULUHAN permission terpisah (granular per sub-layar), bukan 1
// permission per modul. Jadi slug di bawah kadang cuma REPRESENTATIF (yang
// paling sering dipakai/menaungi), ditandai `// varian:` kalau ada permission
// lain yang relevan tapi belum dipakai di sini — jangan hapus catatan itu,
// itu daftar kandidat kalau nanti item menu dipecah lebih detail.
//
// Yang ditandai `// TODO-permission:` = tidak ketemu kolom yang cocok persis
// di 1211 nama itu, dipakai fallback terdekat — JANGAN dianggap final, cek
// ulang ke kode Java (fungsi.akses) sebelum dipakai beneran.
//
// Aturan tampil menu tetap sama seperti referensi (semantik OR, berjenjang):
// grup pakai permission MODUL, children pakai permission HALAMAN sendiri, item
// tampil kalau role punya salah satunya, grup tampil kalau ≥1 anak lolos. Grup
// TANPA field `permission` (banyak di bawah, karena Khanza asli memang tidak
// punya 1 flag umum buat grup itu) berarti visibilitasnya 100% ditentukan
// oleh anak-anaknya.

export const allMenu = [
  {
    title: 'Utama',
    items: [
      // Dashboard TIDAK ADA di Khanza asli (app desktop lama tidak punya
      // konsep landing page ringkasan) — 'dashboard' murni permission BARU
      // untuk Electron, tidak perlu dicocokkan ke sik.sql.
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, permission: 'dashboard' },
    ],
  },
  {
    title: 'Pelayanan Pasien',
    items: [
      // 1. Registrasi & Pendaftaran Pasien
      { to: '/registrasi', label: 'Registrasi & Pendaftaran', icon: ClipboardList, permission: 'registrasi' },
      // 2. IGD — layar encounter-nya WAJIB nyertain komponen <FormulirRM :encounter="triase" />
      { to: '/igd', label: 'IGD', icon: Siren, permission: 'igd' },
      // 3. Rawat Jalan — layar encounter-nya WAJIB nyertain komponen <FormulirRM :encounter="ralan" />
      { to: '/rawat-jalan', label: 'Rawat Jalan / Poliklinik', icon: Stethoscope, permission: 'tindakan_ralan' },
      // 4. Rawat Inap — layar encounter-nya WAJIB nyertain komponen <FormulirRM :encounter="ranap" />
      {
        label: 'Rawat Inap', icon: BedDouble, permission: 'kamar_inap',
        children: [
          { to: '/rawat-inap/kamar',         label: 'Kamar Inap',           icon: DoorOpen, permission: 'kamar' },
          { to: '/rawat-inap/pemeriksaan',   label: 'Pemeriksaan Ranap',    icon: Stethoscope, permission: 'tindakan_ranap' },
          { to: '/rawat-inap/daftar-pasien', label: 'Daftar Pasien Ranap',  icon: List, permission: 'daftar_pasien_ranap' },
        ],
      },
      // 5. Operasi / Bedah
      {
        label: 'Operasi / Bedah', icon: Scissors, permission: 'operasi',
        children: [
          { to: '/operasi/booking', label: 'Booking Operasi',     icon: CalendarPlus, permission: 'booking_operasi' },
          { to: '/operasi/ruang',   label: 'Ruang Operasi',       icon: DoorOpen,     permission: 'ruang_ok' },
          { to: '/operasi/obat',    label: 'Obat & BHP Operasi',  icon: Pill,         permission: 'penggunaan_bhp_ok' },
        ],
      },
      // 6. Laboratorium (termasuk PA & MB)
      {
        label: 'Laboratorium', icon: FlaskConical, permission: 'periksa_lab',
        children: [
          { to: '/lab/input-hasil', label: 'Input Hasil Lab',   icon: FileText,   permission: 'periksa_lab' },
          { to: '/lab/pa',          label: 'Patologi Anatomi',  icon: Microscope, permission: 'pemeriksaan_lab_pa' },
          { to: '/lab/mb',          label: 'Mikrobiologi',      icon: Microscope, permission: 'pemeriksaan_lab_mb' },
          { to: '/lab/permintaan',  label: 'Permintaan Lab',    icon: ClipboardList, permission: 'permintaan_lab' },
        ],
      },
      // 7. Radiologi
      {
        label: 'Radiologi', icon: Radiation, permission: 'periksa_radiologi',
        children: [
          { to: '/radiologi/permintaan', label: 'Permintaan Radiologi', icon: ClipboardList, permission: 'permintaan_radiologi' },
          { to: '/radiologi/dosis',      label: 'Dosis Radiasi',        icon: Gauge,         permission: 'dosis_radiologi' },
        ],
      },
      // 8. Farmasi / Apotek
      {
        label: 'Farmasi / Apotek', icon: Pill, permission: 'resep_obat',
        children: [
          { to: '/farmasi/resep',        label: 'Resep & Racikan',    icon: FileText,        permission: 'resep_obat' },
          { to: '/farmasi/industri',     label: 'Industri Farmasi',   icon: Factory,         permission: 'industrifarmasi' },
          // varian: sirkulasi_obat2..6 (beberapa nomor lain juga ada di sik.sql, kemungkinan per-lokasi/gudang)
          { to: '/farmasi/mutasi-stok',  label: 'Mutasi Stok Obat',   icon: ArrowLeftRight,  permission: 'sirkulasi_obat' },
        ],
      },
      // 9. Gizi / Diet
      { to: '/gizi', label: 'Gizi / Diet', icon: Utensils, permission: 'diet_pasien' },
      // 10. Bank Darah / UTD
      { to: '/bank-darah', label: 'Bank Darah (UTD)', icon: Droplet, permission: 'pengambilan_utd' },
      // 11. Rekam Medis — HANYA administratif (pelacakan fisik berkas).
      // ~180 formulir asesmen klinis SENGAJA TIDAK didaftarkan di sini — itu
      // dipanggil kontekstual dari <FormulirRM :encounter="..."/> di layar
      // IGD/Rawat Jalan/Rawat Inap (lihat komentar di item-item itu).
      // Tidak ada permission umum "rekam_medis" di sik.sql, jadi grup ini
      // sengaja tanpa `permission` — visibilitasnya murni dari anak-anaknya.
      {
        label: 'Rekam Medis', icon: FolderOpen,
        children: [
          { to: '/rekam-medis/sirkulasi', label: 'Sirkulasi Berkas',        icon: RefreshCcw,   permission: 'peminjaman_berkas' },
          { to: '/rekam-medis/mutasi',    label: 'Mutasi Berkas',           icon: ArrowLeftRight, permission: 'mutasi_berkas' },
          { to: '/rekam-medis/retensi',   label: 'Retensi',                 icon: Archive,      permission: 'retensi_rm' },
          { to: '/rekam-medis/status',    label: 'Status Kelengkapan RM',   icon: CheckSquare,  permission: 'status_data_rm' },
        ],
      },
      // 30. MCU & Kesehatan Perusahaan
      {
        label: 'MCU & Kesehatan Perusahaan', icon: Briefcase, permission: 'perusahaan_pasien',
        children: [
          { to: '/mcu/perusahaan', label: 'Data Perusahaan',        icon: Building2,   permission: 'perusahaan_pasien' },
          { to: '/mcu/booking',    label: 'Booking MCU',            icon: CalendarPlus, permission: 'booking_mcu_perusahaan' },
          { to: '/mcu/kesimpulan', label: 'Kesimpulan & Anjuran',   icon: NotebookPen, permission: 'master_kesimpulan_anjuran_mcu' },
        ],
      },
    ],
  },
  {
    title: 'Keuangan & Administrasi',
    items: [
      // 12. Kasir & Billing
      {
        label: 'Kasir & Billing', icon: Wallet, permission: 'kasir_ralan',
        children: [
          { to: '/kasir/rawat-jalan', label: 'Kasir Rawat Jalan',      icon: Monitor,     permission: 'kasir_ralan' },
          { to: '/kasir/rawat-inap',  label: 'Pembayaran Rawat Inap',  icon: Monitor,     permission: 'billing_ranap' },
          { to: '/kasir/closing',     label: 'Closing Kasir',          icon: Lock,        permission: 'closing_kasir' },
          { to: '/kasir/deposit',     label: 'Deposit Pasien',         icon: PiggyBank,   permission: 'deposit_pasien' },
          { to: '/kasir/piutang',     label: 'Piutang',                icon: FileWarning, permission: 'piutang_pasien' },
          // 32. Virtual Account / Bank — ditaruh di sini (bukan di Bridging) karena
          // di kode asli dipanggil dari alur Kasir saat pasien pilih metode bayar
          // transfer/VA. TODO-permission: sik.sql pecah per bank (pembayaran_bank_jateng/
          // _papua/_jabar/_mandiri, pembayaran_briva) + payment_point/payment_point2 —
          // 'payment_point' dipakai sbg representatif, pertimbangkan dipecah per bank nanti.
          { to: '/kasir/virtual-account', label: 'Virtual Account / Bank', icon: CreditCard, permission: 'payment_point' },
        ],
      },
      // 13. Keuangan / Akuntansi
      {
        label: 'Keuangan / Akuntansi', icon: BarChart2, permission: 'keuangan',
        children: [
          { to: '/keuangan/jurnal',     label: 'Jurnal',          icon: BookText,   permission: 'posting_jurnal' },
          // TODO-permission: TIDAK ADA kolom "laba_rugi" di sik.sql sama sekali —
          // fallback ke 'keuangan' (flag generik modul keuangan), cek ulang ke
          // DlgLabaRugi.java (kelas mana yang beneran gate akses-nya) sebelum final.
          { to: '/keuangan/laba-rugi',  label: 'Laba Rugi',       icon: TrendingUp, permission: 'keuangan' },
          { to: '/keuangan/rekening',       label: 'Rekening / Akun', icon: Landmark,   permission: 'akun_rekening' },
          { to: '/keuangan/rekening-tahun', label: 'Rekening Tahun',   icon: FolderOpen, permission: 'rekening_tahun' },
          { to: '/keuangan/pengaturan-rekening', label: 'Pengaturan Rekening', icon: Settings, permission: 'pengaturan_rekening' },
          { to: '/keuangan/master-akun', label: 'Master Akun Spesifik & Kategori', icon: Bookmark, permission: 'akun_bayar' },
        ],
      },
      // 14. Toko — SISTEM RETAIL LENGKAP (33 file di src/toko/), investigasi
      // penuh selesai (lihat Khanza.md section 14). Master Data + Stok Opname
      // DIGARAP (tidak sentuh jurnal Keuangan). Penjualan/Pembelian/Pemesanan/
      // Piutang/Retur* DITUNDA ke Fase 3 — semua itu otomatis posting jurnal
      // ke modul Keuangan yang belum dibangun, keputusan sadar biar tidak ada
      // bagian setengah-jadi yang diam-diam skip akuntansi.
      {
        label: 'Toko (Non-Medis)', icon: ShoppingBag,
        children: [
          { to: '/toko/master',    label: 'Master Data',       icon: Package,        permission: 'toko_barang' },
          { to: '/toko/opname',    label: 'Stok Opname',       icon: ClipboardCheck, permission: 'stok_opname_toko' },
          { to: '/toko/riwayat',   label: 'Riwayat Barang',    icon: History,        permission: 'toko_riwayat_barang' },
          { to: '/toko/penjualan', label: 'Penjualan',         icon: Monitor,        permission: 'toko_penjualan' },
          { to: '/toko/piutang',   label: 'Piutang',           icon: FileWarning,    permission: 'toko_piutang' },
          { to: '/toko/retur',     label: 'Retur Beli/Jual',   icon: RefreshCcw,     permission: 'toko_retur_jual' },
        ],
      },
      // 15. Parkir — tidak ada flag umum "parkir" (Khanza pisah per aksi:
      // parkir_in/parkir_out/parkir_jenis/parkir_barcode/parkir_rekap_*).
      {
        label: 'Parkir', icon: ParkingSquare,
        children: [
          // varian: 'parkir_out' (keluar) permission terpisah dari 'parkir_in' (masuk)
          { to: '/parkir/masuk', label: 'Parkir Masuk/Keluar', icon: CarFront, permission: 'parkir_in' },
          { to: '/parkir/jenis', label: 'Jenis & Tarif',       icon: Tag,      permission: 'parkir_jenis' },
          { to: '/parkir/barcode', label: 'Kartu / Barcode',   icon: IdCard,   permission: 'parkir_barcode' },
        ],
      },
    ],
  },
  {
    title: 'SDM & Operasional Internal',
    items: [
      // 16. Kepegawaian — tidak ada flag umum, pisah per fitur.
      {
        label: 'Kepegawaian', icon: Users,
        children: [
          // varian: 'presensi_bulanan' terpisah dari 'presensi_harian'
          { to: '/kepegawaian/kehadiran',   label: 'Kehadiran / Presensi',        icon: CalendarCheck, permission: 'presensi_harian' },
          { to: '/kepegawaian/jadwal',      label: 'Jadwal Pegawai',              icon: CalendarDays,  permission: 'jadwal_pegawai' },
          // TODO-permission: TIDAK ADA kolom "penggajian" di sik.sql — fallback
          // ke 'pegawai_admin' (flag admin kepegawaian umum), cek ulang ke kode asli.
          { to: '/kepegawaian/penggajian',  label: 'Penggajian',                  icon: Wallet,        permission: 'pegawai_admin' },
          { to: '/kepegawaian/riwayat',     label: 'Riwayat Jabatan/Pendidikan',  icon: History,       permission: 'riwayat_jabatan' },
        ],
      },
      // 17. Inventaris / Gudang (obat/BHP, BUKAN aset RS — itu ada permission
      // terpisah *_aset_inventaris untuk pengadaan aset, belum dipetakan di sini)
      {
        label: 'Inventaris / Gudang', icon: Boxes,
        children: [
          { to: '/inventaris/barang',      label: 'Master Barang',     icon: Package,       permission: 'jenis_barang' },
          { to: '/inventaris/mutasi',      label: 'Mutasi Barang',     icon: ArrowLeftRight, permission: 'mutasi_barang' },
          { to: '/inventaris/kadaluarsa',  label: 'Kadaluarsa Batch',  icon: AlertTriangle, permission: 'kadaluarsa_batch' },
        ],
      },
      // 18. IPSRS — investigasi penuh selesai (lihat Khanza.md section 18).
      // Master Data + Permintaan + Pengajuan + Surat Pemesanan (PO) + Stok
      // Opname + Riwayat DIGARAP (tidak sentuh jurnal Keuangan). Pembelian/
      // Penerimaan/Hibah/Pengeluaran/ReturBeli/Pengambilan UTD DITUNDA ke
      // Fase 3 — semua itu otomatis posting jurnal, sama prinsipnya dgn Toko.
      {
        label: 'IPSRS (Sarana Prasarana)', icon: Wrench,
        children: [
          { to: '/ipsrs/master',          label: 'Master Data',      icon: Package,        permission: ['ipsrs_barang', 'ipsrs_jenis_barang', 'suplier_penunjang'] },
          { to: '/ipsrs/permintaan',      label: 'Permintaan Barang Non Medis',       icon: ClipboardList,  permission: ['permintaan_non_medis', 'ipsrs_stok_keluar'] },
          { to: '/ipsrs/pengajuan',       label: 'Pengajuan Barang', icon: FileCheck2,     permission: 'pengajuan_barang_nonmedis' },
           { to: '/ipsrs/surat-pemesanan', label: 'Surat Pemesanan',  icon: FileText,       permission: 'surat_pemesanan_non_medis' },
           { to: '/ipsrs/stok-opname',     label: 'Stok Opname',      icon: ClipboardCheck, permission: 'stok_opname_logistik' },
          { to: '/ipsrs/riwayat',         label: 'Riwayat Barang',   icon: History,        permission: 'ipsrs_riwayat_barang' },
        ],
      },
      // 19. Perpustakaan — DIGARAP PENUH, dipecah jadi grup (13 flag terpisah
      // di sik.sql: ruang/kategori/jenis/pengarang/penerbit/koleksi/inventaris/
      // set_peminjaman/denda/anggota/peminjaman/bayar_denda/ebook_perpustakaan).
      // `ebook_perpustakaan` TIDAK ada di sini — itu WebView ke webapps/, lihat
      // Khanza.md > "Arsitektur Hybrid WebView".
      {
        label: 'Perpustakaan', icon: BookOpen,
        children: [
          { to: '/perpustakaan/master',     label: 'Master Data',           icon: Tags,              permission: 'jenis_perpustakaan' },
          { to: '/perpustakaan/koleksi',    label: 'Koleksi (Katalog Buku)', icon: BookOpen,          permission: 'koleksi_perpustakaan' },
          { to: '/perpustakaan/anggota',    label: 'Anggota',                icon: UserCircle,        permission: 'anggota_perpustakaan' },
          { to: '/perpustakaan/inventaris', label: 'Inventaris',             icon: Archive,           permission: 'inventaris_perpustakaan' },
          { to: '/perpustakaan/sirkulasi',  label: 'Sirkulasi (Pinjam/Kembali)', icon: Repeat,        permission: 'peminjaman_perpustakaan' },
          { to: '/perpustakaan/denda',      label: 'Denda',                  icon: Coins,             permission: 'denda_perpustakaan' },
          { to: '/perpustakaan/pengaturan', label: 'Pengaturan Peminjaman',  icon: SlidersHorizontal, permission: 'set_peminjaman_perpustakaan' },
        ],
      },
      // 20. Surat Menyurat — DIKOREKSI dari 'surat_masuk' (representatif awal,
      // salah — SuratMasuk/Keluar TIDAK digarap, JavaFX WebView tanpa DB,
      // lihat SOP). Yang beneran diimplementasi cuma 9 taksonomi arsip fisik
      // (Surat.vue internal tab per jenis, masing2 permission sendiri: rak,
      // almari, klasifikasi, sifat, map, indeks, ruang, status, balas — filter
      // tab dilakukan DI DALAM Surat.vue, bukan di sini). Representatif: surat_rak.
      { to: '/surat', label: 'Surat Menyurat', icon: Mail, permission: 'surat_rak' },
    ],
  },
  {
    title: 'Mutu, PPI & Akreditasi',
    items: [
      // 21. PPI / HAIs — tidak ada flag umum, 5 audit_bundle_* terpisah.
      {
        label: 'PPI / HAIs', icon: ShieldCheck,
        children: [
          // varian: audit_bundle_ido, audit_bundle_isk, audit_bundle_plabsi, audit_bundle_vap (masing2 permission sendiri)
          { to: '/ppi/audit-bundle', label: 'Audit Bundle (IADP/IDO/ISK/VAP/PLABSI)', icon: ClipboardCheck, permission: 'audit_bundle_iadp' },
          { to: '/ppi/kepatuhan',    label: 'Kepatuhan APD & Cuci Tangan',            icon: CheckSquare,    permission: 'audit_kepatuhan_apd' },
          { to: '/ppi/hais-bangsal', label: 'HAIs per Bangsal',                       icon: BedDouble,      permission: 'hais_perbangsal' },
        ],
      },
      // 22. PCRA / ICRA — tidak ada flag umum, ~10 permission terpisah per sub-form.
      {
        label: 'PCRA / ICRA', icon: HardHat,
        children: [
          { to: '/pcra-icra/pra-konstruksi',       label: 'Risiko Pra-Konstruksi',   icon: Building2,     permission: 'pcra_icra_pengkajian_risiko_prakonstruksi' },
          // varian: pcra_icra_identifkasi_risiko_keselamatan/_kebakaran/_utilitas (masing2 terpisah)
          { to: '/pcra-icra/identifikasi-risiko',  label: 'Identifikasi Risiko',     icon: AlertTriangle, permission: 'pcra_icra_identifkasi_risiko_infeksi' },
        ],
      },
      // 31. Insiden Keselamatan Pasien — BEDA dari PPI/HAIs di atas (standar
      // akreditasi "Sasaran Keselamatan Pasien", bukan pencegahan infeksi)
      { to: '/insiden-keselamatan', label: 'Insiden Keselamatan Pasien', icon: AlertOctagon, permission: 'insiden_keselamatan_pasien' },
      // 23. Laporan RS (RL & Statistik) — tidak ada flag umum, tiap nomor RL
      // permission sendiri-sendiri.
      {
        label: 'Laporan RS', icon: FileBarChart,
        children: [
          // varian: rl33, rl37, rl38 (masing2 permission terpisah dari rl32)
          { to: '/laporan/rl',           label: 'RL 3.2 – 3.8',                      icon: FileText,  permission: 'rl32' },
          // varian: rl4b, rl4asebab, rl4bsebab
          { to: '/laporan/rl4',          label: 'RL 4A / 4B',                        icon: FileText,  permission: ['rl4a', 'rl4b', 'rl4asebab', 'rl4bsebab'] },
          { to: '/laporan/tempat-tidur', label: 'Ketersediaan Tempat Tidur (RL1.3)', icon: BedDouble, permission: 'rl1_3_ketersediaan_kamar' },
          { to: '/laporan/bor-alos',     label: 'BOR / ALOS',                        icon: Gauge,     permission: 'hitung_bor' },
          // varian: surveilans_ranap, penyakit_pd3i, surveilans_pd3i
          { to: '/laporan/surveilans',   label: 'Surveilans Penyakit (DKK)',         icon: Activity,  permission: 'surveilans_ralan' },
        ],
      },
    ],
  },
  {
    title: 'Lain-lain',
    items: [
      // 24. ZIS / CSR — representatif 'zis_penghasilan_penerima_dankes'.
      // sik.sql punya ~15 flag zis_*_penerima_dankes terpisah (ukuran rumah,
      // dinding, lantai, atap, dst) — pertimbangkan dipecah kalau digarap.
      { to: '/zis-csr', label: 'ZIS / CSR', icon: HandHeart, permission: 'zis_penghasilan_penerima_dankes' },
      {
        label: 'E-Eksekutif', icon: LineChart, permission: 'harian_menejemen',
        children: [
          { to: '/e-eksekutif', label: 'Dashboard', icon: LineChart, permission: 'harian_menejemen' },
          {
            label: 'Pelayanan', icon: Activity, permission: 'harian_menejemen',
            children: [
              { to: '/e-eksekutif/rawat-jalan', label: 'Rawat Jalan', icon: Stethoscope, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/igd', label: 'IGD', icon: Siren, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/rawat-inap', label: 'Rawat Inap', icon: BedDouble, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/laboratorium', label: 'Laboratorium', icon: FlaskConical, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/radiologi', label: 'Radiologi', icon: Radiation, permission: 'harian_menejemen' },
            ]
          },
          {
            label: 'Inventori Farmasi', icon: Boxes, permission: 'harian_menejemen',
            children: [
              { to: '/e-eksekutif/farmasi/sisa-stok', label: 'Sisa Stok & Nilai Aset', icon: Package, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/darurat-stok', label: 'Darurat Stok (Defecta)', icon: AlertTriangle, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/kadaluarsa', label: 'Kadaluarsa 3 Bulan', icon: History, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/pengadaan', label: 'Ringkasan Pengadaan', icon: FileCheck2, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/penerimaan', label: 'Ringkasan Penerimaan', icon: ArrowLeftRight, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/hibah', label: 'Ringkasan Hibah', icon: HandHeart, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/penjualan', label: 'Ringkasan Penjualan', icon: Monitor, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/beri-obat', label: 'Ringkasan Beri Obat', icon: Pill, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/piutang', label: 'Ringkasan Piutang Obat', icon: FileWarning, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/stok-keluar', label: 'Ringkasan Stok Keluar', icon: ArrowLeftRight, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/retur-suplier', label: 'Retur Ke Suplier', icon: RefreshCcw, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/retur-pasien', label: 'Retur Dari Pasien', icon: RefreshCcw, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/obat-poli', label: 'Obat Per Poli', icon: Stethoscope, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/obat-dokter', label: 'Obat Per Dokter', icon: UserCircle, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/penerimaan-vendor', label: 'Penerimaan Vendor / Bulan', icon: TrendingUp, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/farmasi/stok-mati', label: 'Stok Tidak Bergerak', icon: Archive, permission: 'harian_menejemen' },
            ]
          },
          {
            label: 'Inventori Non Medis', icon: Boxes, permission: 'ipsrs_barang',
            children: [
              { to: '/e-eksekutif/non-medis/sisa-stok', label: 'Sisa Stok & Nilai Aset', icon: Package, permission: 'ipsrs_barang' },
              { to: '/e-eksekutif/non-medis/pengadaan', label: 'Ringkasan Pengadaan', icon: FileCheck2, permission: 'ipsrs_barang' },
              { to: '/e-eksekutif/non-medis/penerimaan', label: 'Ringkasan Penerimaan', icon: ArrowLeftRight, permission: 'ipsrs_barang' },
              { to: '/e-eksekutif/non-medis/hibah', label: 'Ringkasan Hibah', icon: HandHeart, permission: 'ipsrs_barang' },
              { to: '/e-eksekutif/non-medis/stok-keluar', label: 'Ringkasan Stok Keluar', icon: ArrowLeftRight, permission: 'ipsrs_barang' },
              { to: '/e-eksekutif/non-medis/retur-suplier', label: 'Retur Ke Suplier', icon: RefreshCcw, permission: 'ipsrs_barang' },
              { to: '/e-eksekutif/non-medis/penerimaan-vendor', label: 'Penerimaan Vendor / Bulan', icon: TrendingUp, permission: 'ipsrs_barang' },
            ]
          },
          {
            label: 'Inventori Dapur', icon: Utensils, permission: 'dapur_barang',
            children: [
              { to: '/e-eksekutif/dapur/sisa-stok', label: 'Sisa Stok & Nilai Aset', icon: Package, permission: 'dapur_barang' },
              { to: '/e-eksekutif/dapur/pengadaan', label: 'Ringkasan Pengadaan', icon: FileCheck2, permission: 'dapur_barang' },
              { to: '/e-eksekutif/dapur/penerimaan', label: 'Ringkasan Penerimaan', icon: ArrowLeftRight, permission: 'dapur_barang' },
              { to: '/e-eksekutif/dapur/hibah', label: 'Ringkasan Hibah', icon: HandHeart, permission: 'dapur_barang' },
              { to: '/e-eksekutif/dapur/stok-keluar', label: 'Ringkasan Stok Keluar', icon: ArrowLeftRight, permission: 'dapur_barang' },
              { to: '/e-eksekutif/dapur/retur-suplier', label: 'Retur Ke Suplier', icon: RefreshCcw, permission: 'dapur_barang' },
              { to: '/e-eksekutif/dapur/penerimaan-vendor', label: 'Penerimaan Vendor / Bulan', icon: TrendingUp, permission: 'dapur_barang' },
            ]
          },
          {
            label: 'Kendali Mutu', icon: ClipboardCheck, permission: 'harian_menejemen',
            children: [
              { to: '/e-eksekutif/mutu/poli', label: 'Lama Pelayanan Poli', icon: Stethoscope, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/mutu/rawat-jalan', label: 'Lama Pelayanan Rawat Jalan', icon: ClipboardList, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/mutu/apotek', label: 'Lama Pelayanan Apotek', icon: Pill, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/mutu/lab-pa', label: 'Lama Pelayanan Lab PA', icon: FlaskConical, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/mutu/lab-pk', label: 'Lama Pelayanan Lab PK', icon: FlaskConical, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/mutu/lab-mb', label: 'Lama Pelayanan Lab MB', icon: FlaskConical, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/mutu/radiologi', label: 'Lama Pelayanan Radiologi', icon: Radiation, permission: 'harian_menejemen' },
            ]
          },
          {
            label: 'Pendapatan Kasir', icon: Wallet, permission: 'harian_menejemen',
            children: [
              { to: '/e-eksekutif/kasir/akun-bayar', label: 'Pembayaran Per Akun Bayar', icon: CreditCard, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/kasir/rekening-coa', label: 'Pembayaran Per Akun Rekening/COA', icon: Landmark, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/kasir/akun-piutang', label: 'Piutang Per Akun Piutang', icon: FileWarning, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/kasir/akun-closing', label: 'Pendapatan Per Akun Closing', icon: Wallet, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/kasir/rekening', label: 'Pendapatan Per Akun Rekening', icon: Landmark, permission: 'harian_menejemen' },
            ]
          },
          {
            label: 'Keuangan & Akuntansi', icon: Landmark, permission: 'harian_menejemen',
            children: [
              { to: '/e-eksekutif/keuangan/hutang/farmasi', label: 'Hutang Vendor Farmasi', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/hutang/nonmedis', label: 'Hutang Vendor Non Medis', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/hutang/dapur', label: 'Hutang Vendor Dapur', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/hutang/inventaris', label: 'Hutang Vendor Inventaris', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/hutang/lain', label: 'Beban Hutang Lain', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/piutang/pasien', label: 'Piutang Pasien Belum Lunas', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/piutang/obat', label: 'Piutang Obat Belum Lunas', icon: AlertOctagon, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/laporan', label: 'Laporan Keuangan', icon: FileBarChart, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/rekening-tahun', label: 'Rekening Tahun', icon: FolderOpen, permission: 'harian_menejemen' },
              { to: '/e-eksekutif/keuangan/saldo-bulanan', label: 'Saldo Akun Per Bulan', icon: FolderOpen, permission: 'harian_menejemen' },
            ]
          },
        ],
      },
      // 26. SMS Gateway
      { to: '/sms-gateway', label: 'SMS Gateway', icon: MessageSquare, permission: 'sms' },
      // 27. Bridging BPJS — tidak ada flag umum "bpjs", puluhan permission
      // bpjs_* terpisah per endpoint/aksi.
      {
        label: 'Bridging BPJS', icon: Link2,
        children: [
          // varian: bpjs_cek_kartu, bpjs_cek_nik, bpjs_sep_internal
          { to: '/bridging/sep',        label: 'SEP & Kepesertaan',  icon: IdCard,     permission: 'bpjs_sep' },
          { to: '/bridging/klaim',      label: 'Monitoring Klaim',   icon: FileCheck2, permission: 'bpjs_monitoring_klaim' },
          // varian: puluhan bpjs_referensi_* & bpjs_cek_referensi_* lain (poli/dokter/diagnosa/faskes/dst)
          { to: '/bridging/referensi',  label: 'Referensi & Mapping', icon: ListTree,  permission: 'bpjs_referensi_poli' },
        ],
      },
      // 29. TNI / Polri — tidak ada flag umum, TNI & Polri masing2 set
      // permission sendiri (golongan/satuan/jabatan/pangkat_tni vs _polri).
      {
        label: 'TNI / Polri', icon: Shield,
        children: [
          // Catatan ejaan asli sik.sql: 'daftar_pasien_ranaptni' (TANPA underscore
          // sebelum "tni"), beda pola dari 'daftar_pasien_ranap_polri' (DENGAN underscore).
          { to: '/tni-polri/daftar-ranap', label: 'Daftar Pasien Ranap TNI/Polri', icon: BedDouble, permission: 'daftar_pasien_ranap_polri' },
          { to: '/tni-polri/harian_menejemen',      label: 'Laporan Penyakit TNI/Polri',    icon: FileBarChart, permission: 'harian_menejemen_penyakit_polri' },
        ],
      },
    ],
  },
]

// 28. Setting / Keamanan — mengikuti pola bottomMenu referensi (flat, di bawah sidebar)
export const bottomMenu = [
  // TODO-permission BESAR: TIDAK ADA kolom permission untuk "kelola user" di
  // sik.sql. Ini masuk akal — di Khanza asli, manajemen user cuma bisa
  // dilakukan Admin Utama (dicek via akses.getjml1()>=1 saat login, LIHAT
  // Khanza.md bagian "Ringkasan Alur Login"), bukan lewat flag permission
  // biasa. Untuk sistem baru: pertimbangkan bikin ini role-check terpisah
  // ("role === 'Administrator'"), bukan entry di tabel permissions.
  // Digabung jadi 1 hub tab-berjenjang (Pengaturan.vue: top-level User/Database,
  // dst) — dulu 2 entry terpisah ("Manajemen User" + "Konfigurasi Aplikasi",
  // yang kedua masih placeholder isinya cuma duplikat panel migrasi). Lihat
  // README.md > "Login & Permission" & Pengaturan.vue buat struktur tab-nya.
  // `permission` array — link sidebar ini muncul kalau user punya SALAH SATU
  // dari 4 permission tab di dalam Pengaturan.vue (authStore.can() sudah
  // dukung array = OR), bukan cuma 'pengaturan-user'. Kalau nanti nambah tab
  // baru di Pengaturan.vue, tambahkan slug permission-nya di sini juga.
  { to: '/pengaturan/aplikasi',       label: 'Pengaturan',                  icon: Settings,  permission: ['pengaturan-aplikasi'] },
  { to: '/pengaturan/audit-login',    label: 'Audit Login',                 icon: History,   permission: 'tracer_login' },
  // Master data TNI/Polri (pangkat, golongan, jabatan, satuan) — data setup
  // jarang diubah, wajar ditaruh di Pengaturan, bukan sidebar utama.
  // varian: satuan_tni, jabatan_tni, pangkat_tni, dan set golongan_polri/satuan_polri/jabatan_polri/pangkat_polri terpisah
  { to: '/pengaturan/master-tni-polri', label: 'Master Data TNI/Polri',     icon: Shield,    permission: 'golongan_tni' },
]

export function buildBreadcrumbs(path) {
    function findPath(items) {
        for (const item of items) {
            if (item.to === path) return [{ label: item.label, icon: item.icon }]
            if (item.children) {
                const childPath = findPath(item.children)
                if (childPath) return [{ label: item.label, icon: item.icon }, ...childPath]
            }
        }
        return null
    }

    for (const section of allMenu) {
        const found = findPath(section.items)
        if (found) return found
    }
    for (const item of bottomMenu) {
        if (item.to === path) return [{ label: item.label, icon: item.icon }]
    }
    return [{ label: path.replace('/', '') }]
}
