import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import Aktivasi  from '../views/base/Aktivasi.vue'
import Login     from '../views/base/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Parkir    from '../views/parkir/Parkir.vue'
import Toko          from '../views/toko/Toko.vue'
import Perpustakaan  from '../views/perpustakaan/Perpustakaan.vue'
import Surat         from '../views/surat/Surat.vue'
import Ipsrs          from '../views/ipsrs/Ipsrs.vue'
import Pengaturan    from '../views/base/Pengaturan.vue'
import Placeholder   from '../views/base/Placeholder.vue'

// Fase -1/0/1 (lihat Khanza.md > "Urutan Migrasi Modul") sudah punya halaman
// nyata. Modul Fase 2-6 masih Placeholder — sengaja BUKAN 404, biar sidebar
// tetap bisa dites lengkap sebelum tiap modul dikerjakan sesuai SOP.
const FASE_1_ROUTES = [
    { path: '/parkir/masuk', component: Parkir },
    { path: '/parkir/jenis', component: Parkir },
    // Toko jadi grup 4 anak di menu.js (barang/penjualan/piutang/retur) —
    // semua diarahkan ke komponen placeholder Toko.vue yang sama dulu,
    // sampai tiap sub-fiturnya digarap beneran sesuai SOP.
    { path: '/toko/barang', component: Toko },
    { path: '/toko/penjualan', component: Toko },
    { path: '/toko/piutang', component: Toko },
    { path: '/toko/retur', component: Toko },
    { path: '/perpustakaan', component: Perpustakaan },
    { path: '/surat', component: Surat },
    { path: '/ipsrs', component: Ipsrs },
]

const PLACEHOLDER_PATHS = [
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
    '/laporan/rl', '/laporan/rl4', '/laporan/tempat-tidur', '/laporan/bor-alos', '/laporan/surveilans',
    '/zis-csr', '/e-eksekutif', '/sms-gateway',
    '/bridging/sep', '/bridging/klaim', '/bridging/referensi',
    '/tni-polri/daftar-ranap', '/tni-polri/laporan',
    '/pengaturan/audit-login', '/pengaturan/master-tni-polri',
]

const routes = [
    { path: '/', redirect: '/aktivasi' },
    { path: '/aktivasi', component: Aktivasi, meta: { layout: false } },
    { path: '/login', component: Login, meta: { layout: false } },
    { path: '/dashboard', component: Dashboard, meta: { layout: true, auth: true, permission: 'dashboard' } },
    { path: '/pengaturan/user', component: Pengaturan, meta: { layout: true, auth: true, permission: 'pengaturan-user' } },
    { path: '/pengaturan/aplikasi', component: Pengaturan, meta: { layout: true, auth: true, permission: 'pengaturan-aplikasi' } },
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
