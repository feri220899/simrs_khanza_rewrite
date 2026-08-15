import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import PengaturanAwal from '../views/base/PengaturanAwal.vue'
import Aktivasi  from '../views/base/Aktivasi.vue'
import Login     from '../views/base/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import ParkirJenis   from '../views/parkir/JenisTarif.vue'
import ParkirBarcode from '../views/parkir/KartuBarcode.vue'
import ParkirMasuk   from '../views/parkir/Masuk.vue'
import TokoMaster  from '../views/toko/Master.vue'
import TokoOpname  from '../views/toko/Opname.vue'
import TokoRiwayat from '../views/toko/Riwayat.vue'
import PerpusMaster     from '../views/perpustakaan/Master.vue'
import PerpusKoleksi    from '../views/perpustakaan/Koleksi.vue'
import PerpusAnggota    from '../views/perpustakaan/Anggota.vue'
import PerpusInventaris from '../views/perpustakaan/Inventaris.vue'
import PerpusSirkulasi  from '../views/perpustakaan/Sirkulasi.vue'
import PerpusDenda      from '../views/perpustakaan/Denda.vue'
import PerpusPengaturan from '../views/perpustakaan/Pengaturan.vue'
import Surat         from '../views/surat/Surat.vue'
import IpsrsMaster         from '../views/ipsrs/Master.vue'
import IpsrsPermintaan     from '../views/ipsrs/Permintaan.vue'
import IpsrsPengajuan      from '../views/ipsrs/Pengajuan.vue'
import IpsrsSuratPemesanan from '../views/ipsrs/SuratPemesanan.vue'
import IpsrsStokOpname     from '../views/ipsrs/StokOpname.vue'
import IpsrsRiwayat        from '../views/ipsrs/Riwayat.vue'
import LaporanRl13         from '../views/laporan/KetersediaanTempatTidur.vue'
import LaporanBorAlos       from '../views/laporan/BorAlos.vue'
import LaporanRl3            from '../views/laporan/Rl3.vue'
import LaporanRl4            from '../views/laporan/Rl4.vue'
import EEksekutifLanding     from '../views/eeksekutif/Landing.vue'
import EEksekutifPelayanan   from '../views/eeksekutif/PelayananView.vue'
import Pengaturan    from '../views/base/Pengaturan.vue'
import Placeholder   from '../views/base/Placeholder.vue'

// Fase -1/0/1 (lihat Khanza.md > "Urutan Migrasi Modul") sudah punya halaman
// nyata. Modul Fase 2-6 masih Placeholder — sengaja BUKAN 404, biar sidebar
// tetap bisa dites lengkap sebelum tiap modul dikerjakan sesuai SOP.
const FASE_1_ROUTES = [
    { path: '/parkir/masuk', component: ParkirMasuk },
    { path: '/parkir/jenis', component: ParkirJenis },
    { path: '/parkir/barcode', component: ParkirBarcode },
    // Toko: Master Data + Stok Opname sudah digarap (tidak sentuh jurnal
    // Keuangan). Penjualan/Pembelian/Pemesanan/Piutang/Retur DITUNDA ke Fase 3
    // (otomatis posting jurnal ke Keuangan yang belum dibangun) — lihat
    // PLACEHOLDER_PATHS di bawah & Khanza.md section 14.
    { path: '/toko/master', component: TokoMaster },
    { path: '/toko/opname', component: TokoOpname },
    { path: '/toko/riwayat', component: TokoRiwayat },
    { path: '/perpustakaan/master', component: PerpusMaster },
    { path: '/perpustakaan/koleksi', component: PerpusKoleksi },
    { path: '/perpustakaan/anggota', component: PerpusAnggota },
    { path: '/perpustakaan/inventaris', component: PerpusInventaris },
    { path: '/perpustakaan/sirkulasi', component: PerpusSirkulasi },
    { path: '/perpustakaan/denda', component: PerpusDenda },
    { path: '/perpustakaan/pengaturan', component: PerpusPengaturan },
    { path: '/surat', component: Surat },
    // IPSRS: Master Data + Permintaan + Pengajuan + Surat Pemesanan (PO) +
    // Stok Opname + Riwayat sudah digarap (tidak sentuh jurnal Keuangan).
    // Pembelian/Penerimaan/Hibah/Pengeluaran/ReturBeli/Pengambilan UTD
    // DITUNDA ke Fase 3 (otomatis posting jurnal) — lihat PLACEHOLDER_PATHS
    // di bawah & Khanza.md section 14/18.
    { path: '/ipsrs/master', component: IpsrsMaster },
    { path: '/ipsrs/permintaan', component: IpsrsPermintaan },
    { path: '/ipsrs/pengajuan', component: IpsrsPengajuan },
    { path: '/ipsrs/surat-pemesanan', component: IpsrsSuratPemesanan },
    { path: '/ipsrs/stok-opname', component: IpsrsStokOpname },
    { path: '/ipsrs/riwayat', component: IpsrsRiwayat },
    { path: '/laporan/tempat-tidur', component: LaporanRl13 },
    { path: '/laporan/bor-alos', component: LaporanBorAlos },
    { path: '/laporan/rl', component: LaporanRl3 },
    { path: '/laporan/rl4', component: LaporanRl4 },
    { path: '/e-eksekutif', component: EEksekutifLanding },
    { path: '/e-eksekutif/rawat-jalan', component: EEksekutifPelayanan, props: { title: 'Pelayanan Rawat Jalan', type: 'rawatJalan' } },
    { path: '/e-eksekutif/igd', component: EEksekutifPelayanan, props: { title: 'Pelayanan Gawat Darurat', type: 'igd' } },
    { path: '/e-eksekutif/rawat-inap', component: EEksekutifPelayanan, props: { title: 'Pelayanan Rawat Inap', type: 'rawatInap' } },
    { path: '/e-eksekutif/laboratorium', component: EEksekutifPelayanan, props: { title: 'Pelayanan Laboratorium', type: 'lab' } },
    { path: '/e-eksekutif/radiologi', component: EEksekutifPelayanan, props: { title: 'Pelayanan Radiologi', type: 'radiologi' } },
]

const PLACEHOLDER_PATHS = [
    // Toko — ditunda ke Fase 3 (butuh integrasi jurnal Keuangan), lihat Khanza.md section 14.
    '/toko/penjualan', '/toko/pembelian', '/toko/pemesanan', '/toko/piutang', '/toko/retur',
    // IPSRS — modul berjurnal ditunda ke Fase 3, lihat Khanza.md section 18.
    '/ipsrs/pembelian', '/ipsrs/penerimaan', '/ipsrs/hibah', '/ipsrs/pengeluaran',
    '/ipsrs/retur-beli', '/ipsrs/pengambilan-utd', '/ipsrs/laporan',
    '/registrasi', '/igd', '/rawat-jalan',
    '/rawat-inap/kamar', '/rawat-inap/pemeriksaan', '/rawat-inap/daftar-pasien',
    '/operasi/booking', '/operasi/ruang', '/operasi/obat',
    '/lab/input-hasil', '/lab/pa', '/lab/mb', '/lab/permintaan',
    '/radiologi/permintaan', '/radiologi/dosis',
    '/farmasi/resep', '/farmasi/industri', '/farmasi/mutasi-stok',
    '/gizi', '/bank-darah',
    '/rekam-medis/sirkulasi', '/rekam-medis/mutasi', '/rekam-medis/retensi', '/rekam-medis/status',
    '/mcu/perusahaan', '/mcu/booking', '/mcu/kesimpulan',
    '/kasir/rawat-jalan', '/kasir/rawat-inap', '/kasir/closing', '/kasir/deposit', '/kasir/piutang', '/kasir/virtual-account',
    '/keuangan/jurnal', '/keuangan/laba-rugi', '/keuangan/rekening',
    '/kepegawaian/kehadiran', '/kepegawaian/jadwal', '/kepegawaian/penggajian', '/kepegawaian/riwayat',
    '/inventaris/barang', '/inventaris/mutasi', '/inventaris/kadaluarsa',
    '/ppi/audit-bundle', '/ppi/kepatuhan', '/ppi/hais-bangsal',
    '/pcra-icra/pra-konstruksi', '/pcra-icra/identifikasi-risiko',
    '/insiden-keselamatan',
    '/laporan/surveilans',
    '/zis-csr', '/sms-gateway',
    '/bridging/sep', '/bridging/klaim', '/bridging/referensi',
    '/tni-polri/daftar-ranap', '/tni-polri/laporan',
    '/pengaturan/audit-login', '/pengaturan/master-tni-polri',
]

const routes = [
    { path: '/', redirect: '/pengaturan-awal' },
    { path: '/pengaturan-awal', component: PengaturanAwal, meta: { layout: false } },
    { path: '/aktivasi', component: Aktivasi, meta: { layout: false } },
    { path: '/login', component: Login, meta: { layout: false } },
    { path: '/dashboard', component: Dashboard, meta: { layout: true, auth: true, permission: 'dashboard' } },
    // Pengaturan.vue = hub tab berjenjang (top-level User/Database/
    // Environment/Informasi) — isi tiap tab di-embed sebagai child di
    // dalamnya, bukan route terpisah lagi. Rute-nya "/pengaturan/aplikasi"
    // (bukan "/pengaturan/user" lagi) karena sekarang isinya jauh lebih dari
    // sekadar user — permission per-tab ditangani SENDIRI-SENDIRI di dalam
    // Pengaturan.vue (lihat PENGATURAN_TABS > visibleTabs), bukan lewat 1
    // `meta.permission` di sini (lagipula router.beforeEach TIDAK pernah
    // menegakkan meta.permission, cuma meta.auth — jadi field itu di sini
    // dulu memang tidak aktif/menyesatkan).
    { path: '/pengaturan/aplikasi', component: Pengaturan, meta: { layout: true, auth: true } },
    { path: '/pengaturan/user', redirect: '/pengaturan/aplikasi' },
    ...FASE_1_ROUTES.map(r => ({ ...r, meta: { layout: true, auth: true } })),
    ...PLACEHOLDER_PATHS.map(path => ({ path, component: Placeholder, meta: { layout: true, auth: true } })),
    { path: '/:pathMatch(.*)*', component: Placeholder, meta: { layout: true, auth: true } },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

router.beforeEach((to) => {
    const authStore = useAuthStore()
    if (to.meta.auth && !authStore.isAuthenticated) return '/login'
    if (to.path === '/login' && authStore.isAuthenticated) return '/dashboard'
})

export default router
