import 'dotenv/config'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import LisensiService from './electron/LisensiService.js'
import ConfigService  from './electron/ConfigService.js'
import DeviceService  from './electron/DeviceService.js'
import UpdaterService from './electron/UpdaterService.js'
import LogService     from './electron/LogService.js'
import AuthService    from './db/AuthService.js'
import RoleService    from './db/modules/RoleService.js'
import SchemaCompareService from './db/modules/SchemaCompareService.js'
import DatabaseService from './db/DatabaseService.js'
import ParkirService  from './db/modules/ParkirService.js'
import SuratTaksonomiService from './db/modules/SuratTaksonomiService.js'
import PerpustakaanTaksonomiService from './db/modules/PerpustakaanTaksonomiService.js'
import PerpustakaanPenerbitService  from './db/modules/PerpustakaanPenerbitService.js'
import PerpustakaanKoleksiService   from './db/modules/PerpustakaanKoleksiService.js'
import PerpustakaanAnggotaService   from './db/modules/PerpustakaanAnggotaService.js'
import PerpustakaanInventarisService from './db/modules/PerpustakaanInventarisService.js'
import PerpustakaanSirkulasiService from './db/modules/PerpustakaanSirkulasiService.js'
import PerpustakaanDendaService     from './db/modules/PerpustakaanDendaService.js'
import PerpustakaanBayarDendaService from './db/modules/PerpustakaanBayarDendaService.js'
import PerpustakaanPengaturanService from './db/modules/PerpustakaanPengaturanService.js'
import SuratMasukKeluarService from './db/modules/SuratMasukKeluarService.js'
import LaporanRlService from './db/modules/LaporanRlService.js'
import EEksekutifService from './db/modules/EEksekutifService.js'
import EEksekutifNonMedisService from './db/modules/EEksekutifNonMedisService.js'
import EEksekutifDapurService from './db/modules/EEksekutifDapurService.js'
import EEksekutifMutuService from './db/modules/EEksekutifMutuService.js'
import EEksekutifKasirService from './db/modules/EEksekutifKasirService.js'
import EEksekutifAkuntansiService from './db/modules/EEksekutifAkuntansiService.js'
import MinioService from './electron/MinioService.js'
import CacheService from './electron/CacheService.js'
import TokoJenisService from './db/modules/TokoJenisService.js'
import TokoSuplierService from './db/modules/TokoSuplierService.js'
import TokoMemberService from './db/modules/TokoMemberService.js'
import TokoBarangService from './db/modules/TokoBarangService.js'
import TokoOpnameService from './db/modules/TokoOpnameService.js'
import SatuanService from './db/modules/SatuanService.js'
import IpsrsJenisService from './db/modules/IpsrsJenisService.js'
import IpsrsSuplierService from './db/modules/IpsrsSuplierService.js'
import IpsrsBarangService from './db/modules/IpsrsBarangService.js'
import IpsrsRiwayatService from './db/modules/IpsrsRiwayatService.js'
import IpsrsStokService from './db/modules/IpsrsStokService.js'
import IpsrsPermintaanService from './db/modules/IpsrsPermintaanService.js'
import IpsrsLaporanService from './db/modules/IpsrsLaporanService.js'
import IpsrsPengajuanService from './db/modules/IpsrsPengajuanService.js'
import IpsrsSuratPemesananService from './db/modules/IpsrsSuratPemesananService.js'
import KeuanganRekeningService from './db/modules/KeuanganRekeningService.js'
import KeuanganRekeningTahunService from './db/modules/KeuanganRekeningTahunService.js'
import KeuanganPengaturanRekeningService from './db/modules/KeuanganPengaturanRekeningService.js'
import KeuanganMasterAkunService from './db/modules/KeuanganMasterAkunService.js'
import KeuanganJurnalService from './db/modules/KeuanganJurnalService.js'
import KeuanganJurnalHarianService from './db/modules/KeuanganJurnalHarianService.js'
import KeuanganBukuBesarService from './db/modules/KeuanganBukuBesarService.js'

// Sebagian komputer RS (VM/thin-client/GPU tua) gagal launch proses GPU
// Chromium — gejalanya FATAL "GPU process isn't usable" walau sandbox sudah
// benar. `--disable-gpu` CLI flag kadang tidak reliable di edge case ini,
// disableHardwareAcceleration() lebih pasti karena Electron jadi tidak pernah
// coba spawn proses GPU sama sekali. Aktifkan lewat env var, bukan default,
// supaya komputer dengan GPU normal tetap dapat akselerasi hardware.
if (process.env.KHANZA_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration()
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        webPreferences: {
            preload: join(__dirname, '../preload/preload.js'),
        },
    })

    if (process.env.NODE_ENV === 'development') {
        win.loadURL(process.env.ELECTRON_RENDERER_URL)
        win.webContents.openDevTools()
    } else {
        // `Menu.setApplicationMenu(null)` (versi lama) menghapus SELURUH menu
        // bawaan Electron — shortcut reload/zoom/fullscreen ikut nempel di
        // menu itu, jadi ikut hilang semua, bukan cuma devtools-nya. Di sini
        // dibikin menu selengkap default Electron (File/Edit/View/Window),
        // bar-nya TETAP TERLIHAT (beda dari sebelumnya) — cuma item "Toggle
        // Developer Tools" di View yang sengaja dihilangkan/tidak dimasukkan.
        const isMac = process.platform === 'darwin'
        const menu = Menu.buildFromTemplate([
            {
                label: 'File',
                submenu: [
                    isMac ? { role: 'close', label: 'Tutup' } : { role: 'quit', label: 'Keluar' },
                ],
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo', label: 'Urungkan' },
                    { role: 'redo', label: 'Ulangi' },
                    { type: 'separator' },
                    { role: 'cut', label: 'Potong' },
                    { role: 'copy', label: 'Salin' },
                    { role: 'paste', label: 'Tempel' },
                    { role: 'selectAll', label: 'Pilih Semua' },
                ],
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload', label: 'Muat Ulang' },
                    { role: 'forceReload', label: 'Paksa Muat Ulang' },
                    // TIDAK ADA { role: 'toggleDevTools' } di sini — sengaja
                    // dihilangkan, satu-satunya yang tidak diaktifkan lagi.
                    { type: 'separator' },
                    { role: 'resetZoom', label: 'Ukuran Normal' },
                    { role: 'zoomIn', label: 'Perbesar' },
                    // Electron cuma daftarin "CmdOrCtrl+Plus" bawaan buat zoomIn,
                    // padahal tanpa Shift tombolnya "=" di kebanyakan keyboard —
                    // item kedua (disembunyikan dari tampilan) nutup celah itu.
                    { role: 'zoomIn', accelerator: 'CmdOrCtrl+=', visible: false },
                    { role: 'zoomOut', label: 'Perkecil' },
                    { type: 'separator' },
                    { role: 'togglefullscreen', label: 'Layar Penuh' },
                ],
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize', label: 'Minimalkan' },
                    { role: 'close', label: 'Tutup' },
                ],
            },
        ])
        Menu.setApplicationMenu(menu)
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return win
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

// Bungkus ipcMain.handle SUPAYA SEMUA handler otomatis ke-log kalau throw —
// dipakai GANTI ipcMain.handle biasa di semua pendaftaran IPC di bawah
// (151 titik, satu fungsi ini menutup semuanya sekaligus daripada nulis
// try/catch manual di tiap handler). Error tetap DILEMPAR ULANG setelah
// dicatat, supaya renderer tetap dapat promise rejected seperti biasa
// (perilaku IPC-nya sendiri TIDAK berubah, cuma nambah pencatatan).
function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await fn(event, ...args)
        } catch (err) {
            LogService.error(`IPC "${channel}" gagal`, { message: err?.message, stack: err?.stack })
            throw err
        }
    })
}

app.whenReady().then(async () => {
    LogService.init()

    // Muat config MySQL/MinIO tersimpan (kalau sudah pernah diisi lewat
    // layar "Pengaturan Awal") SEBELUM coba connect apa pun — instalasi baru
    // (belum pernah diisi) akan punya keduanya `null`, dan itu wajar, biarkan
    // saja (lihat blok config:* & catatan DB di bawah).
    const savedDbConfig = ConfigService.get('db')
    if (savedDbConfig) DatabaseService.configure(savedDbConfig)
    const savedMinioConfig = ConfigService.get('minio')
    if (savedMinioConfig) MinioService.configure(savedMinioConfig)
    const savedCacheConfig = ConfigService.get('redis')
    if (savedCacheConfig) CacheService.configure(savedCacheConfig)

    // Config MySQL/MinIO — WAJIB didaftarkan duluan & TANPA syarat DB nyambung.
    // Ini justru IPC yang dipakai layar "Pengaturan Awal" utk mengisi
    // kredensial itu SAAT DB/MinIO belum bisa dikonek sama sekali (instalasi
    // baru di RS lain, belum ada apa-apa diisi).
    handle('config:isConfigured',   () => !!ConfigService.get('db'))
    handle('config:getDbConfig',    () => ConfigService.get('db'))
    handle('config:saveDbConfig', (_, cfg) => {
        ConfigService.set('db', cfg)
        DatabaseService.configure(cfg)
        return { success: true }
    })
    handle('config:testDbConnection', (_, cfg) => DatabaseService.testConnection(cfg))
    handle('config:getMinioConfig', () => ConfigService.get('minio'))
    handle('config:saveMinioConfig', (_, cfg) => {
        ConfigService.set('minio', cfg)
        MinioService.configure(cfg)
        return { success: true }
    })
    handle('config:testMinioConnection', (_, cfg) => MinioService.testConnection(cfg))
    handle('config:getCacheConfig', () => ConfigService.get('redis'))
    handle('config:saveCacheConfig', (_, cfg) => {
        ConfigService.set('redis', cfg)
        CacheService.configure(cfg)
        return { success: true }
    })
    handle('config:testCacheConnection', (_, cfg) => CacheService.testConnection(cfg))

    // Export/Import konfigurasi (lihat catatan panjang di ConfigService.js)
    // — dipakai instalasi banyak PC di RS yang sama biar tidak ngetik ulang
    // manual. Didaftar di sini juga (bukan cuma dalam blok DB nyambung),
    // karena Import dipakai justru SEBELUM DB nyambung (dari layar
    // Pengaturan Awal, PC ke-2 dst yang belum diisi apa-apa).
    handle('config:exportConfig', (_, passphrase) => ConfigService.exportToFile(passphrase))
    handle('config:importConfig', async (_, passphrase) => {
        const result = await ConfigService.importFromFile(passphrase)
        if (result.success) {
            if (result.data.db) DatabaseService.configure(result.data.db)
            if (result.data.minio) MinioService.configure(result.data.minio)
            if (result.data.redis) CacheService.configure(result.data.redis)
        }
        return result
    })

    // Cuma connect + pastikan tabel `migrations` ada — TIDAK menjalankan
    // migration apa pun di sini (lihat catatan panjang di DatabaseService.js
    // > runMigrations()). App ini di-install di banyak PC RS sekaligus;
    // migration schema WAJIB dipicu manual sekali oleh Administrator (lewat
    // IPC db:runMigrations di bawah, atau `npm run migrate` dari CLI),
    // bukan otomatis tiap PC nyala.
    //
    // TIDAK app.quit() lagi kalau gagal (beda dari sebelumnya) — instalasi
    // baru yang belum diisi lewat "Pengaturan Awal" MEMANG akan gagal di
    // sini, tapi app harus tetap kebuka supaya layar itu bisa ditampilkan,
    // bukan mati total tanpa UI apa pun.
    try {
        await DatabaseService.get()
    } catch (err) {
        console.error('Gagal konek ke database:', err.message)
        LogService.error('Gagal konek ke database saat start', { message: err.message })
    }

    // Lisensi
    handle('lisensi:aktivasi',   (_, key) => LisensiService.aktivasi(key, DeviceService.getId()))
    handle('lisensi:validasi',   (_, key) => LisensiService.validasi(key, DeviceService.getId()))
    handle('lisensi:deaktivasi', (_, key) => LisensiService.deaktivasi(key, DeviceService.getId()))
    handle('lisensi:verifyToken', (_, token) => LisensiService.verifyToken(token))

    // Config lokal generik (dipakai Aktivasi.vue: lisensi_token/license_key)
    handle('config:get', (_, key)        => ConfigService.get(key))
    handle('config:set', (_, key, value) => ConfigService.set(key, value))

    // Device
    handle('device:getId',   () => DeviceService.getId())
    handle('device:getInfo', () => DeviceService.getInfo())

    // App
    handle('app:getVersion', () => app.getVersion())

    // Auto-update — sumber rilis GitHub Releases repo ini sendiri (lihat
    // `publish` di package.json + .github/workflows/rilis.yml). Hanya CEK &
    // BERI TAHU otomatis saat start (lihat UpdaterService.init()), unduh &
    // pasang SELALU manual lewat tombol (tidak ada auto-download/install
    // diam-diam yang bisa mengganggu shift RS).
    handle('updater:check',    () => UpdaterService.check())
    handle('updater:download', () => UpdaterService.download())
    handle('updater:install',  () => UpdaterService.quitAndInstall())

    // Log error/crash LOKAL komputer ini (lihat LogService.js) — tidak
    // digerbangi token/permission di sini, pola sama seperti config:* (akses
    // sudah dibatasi di sisi client lewat tab "Log" di Pengaturan yang cuma
    // muncul kalau punya permission 'pengaturan-log', bukan cuma-cuma).
    handle('log:getToday',   () => LogService.readToday())
    handle('log:clearToday', () => { LogService.clearToday(); return { success: true } })
    // Dipanggil dari renderer (window.onerror/unhandledrejection) — lihat
    // src/renderer/src/main.js.
    handle('log:reportError', (_, message, meta) => { LogService.error(`Renderer: ${message}`, meta); return { success: true } })

    // Auth — login ke akun ASLI Khanza (tabel `admin`/`user`), lihat
    // README.md > "Login & Permission (pivot MySQL)". TIDAK ADA ganti-password
    // dari Electron — itu mengubah kredensial produksi RS yang dipakai
    // bareng app Java, sengaja belum digarap (keputusan sengaja, bukan lupa;
    // butuh desain terpisah kalau memang diperlukan nanti).
    handle('auth:login', (_, u, p)  => AuthService.login(u, p))
    handle('auth:me',    (_, token) => AuthService.verifySession(token))

    // Kelola Role — "kelola user cuma bisa Admin Utama" di Khanza asli
    // (dicek via jumlah baris cocok tabel `admin` saat login), jadi SEMUA
    // handler di sini di-gate isFullAdmin (Admin Utama ATAU role
    // Administrator), bukan slug permission biasa.
    function requireFullAdmin(token) {
        const session = AuthService.verifySession(token)
        if (!session.success) return { ok: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { ok: false, message: 'Cuma Admin Utama/Administrator yang boleh mengelola role & user' }
        return { ok: true }
    }

    handle('role:list', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listRoles() : []
    })
    handle('role:create', (_, token, nama) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.createRole(nama) : { success: false, message: auth.message }
    })
    handle('role:update', (_, token, id, nama) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.updateRole(id, nama) : { success: false, message: auth.message }
    })
    handle('role:delete', (_, token, id) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.deleteRole(id) : { success: false, message: auth.message }
    })
    handle('role:duplicate', (_, token, id, namaBaru) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.duplicateRole(id, namaBaru) : { success: false, message: auth.message }
    })
    handle('role:permissions:listAll', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listPermissions() : []
    })
    handle('role:permissions:get', (_, token, roleId) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.getRolePermissionIds(roleId) : []
    })
    handle('role:permissions:set', (_, token, roleId, permissionIds) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.setRolePermissions(roleId, permissionIds) : { success: false, message: auth.message }
    })
    handle('role:user:list', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listUserRoleAssignments() : []
    })
    handle('role:user:assign', (_, token, idUser, roleId) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.assignUserRole(idUser, roleId) : { success: false, message: auth.message }
    })
    handle('role:user:remove', (_, token, idUser) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.removeUserRole(idUser) : { success: false, message: auth.message }
    })
    handle('role:user:create', (_, token, data) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.createUserAccount(data) : { success: false, message: auth.message }
    })
    handle('role:user:listOrang', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listOrangUntukUser() : []
    })

    // Parkir (Fase 1 — contoh modul pertama). Baca (list/cek) tidak di-gate
    // permission khusus (sama seperti Java asli — dialognya sendiri yang
    // dibuka lewat menu ber-permission, isi tabelnya terbuka begitu dialog
    // kebuka). Tulis (create/update/delete) DI-GATE server-side ke permission
    // 'parkir_jenis'/'parkir_barcode' — beda dari Java asli yang cuma
    // disable tombolnya di UI (isCek()), di sini dicek ulang tiap request.
    handle('parkir:listJenis',   (_, params) => ParkirService.listJenis(params))
    handle('parkir:nextJenisKode', () => ParkirService.nextJenisKode())
    handle('parkir:createJenis', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_jenis')
        return auth.ok ? ParkirService.createJenis(data) : { success: false, message: auth.message }
    })
    handle('parkir:updateJenis', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_jenis')
        return auth.ok ? ParkirService.updateJenis(oldKode, data) : { success: false, message: auth.message }
    })
    handle('parkir:deleteJenis', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'parkir_jenis')
        return auth.ok ? ParkirService.deleteJenis(kode) : { success: false, message: auth.message }
    })

    handle('parkir:listBarcode',    (_, params) => ParkirService.listBarcode(params))
    handle('parkir:cekBarcode',     (_, kode) => ParkirService.cekBarcode(kode))
    handle('parkir:nextKartuNomor', () => ParkirService.nextKartuNomor())
    handle('parkir:createBarcode', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_barcode')
        return auth.ok ? ParkirService.createBarcode(data) : { success: false, message: auth.message }
    })
    handle('parkir:updateBarcode', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_barcode')
        return auth.ok ? ParkirService.updateBarcode(oldKode, data) : { success: false, message: auth.message }
    })
    handle('parkir:deleteBarcode', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'parkir_barcode')
        return auth.ok ? ParkirService.deleteBarcode(kode) : { success: false, message: auth.message }
    })

    // Surat — 9 tabel taksonomi identik (Rak/Almari/Klasifikasi/Sifat/Map/
    // Indeks/Ruang/Status/Balas), SATU set handler generik diparameterkan
    // `jenis` (di-whitelist di SuratTaksonomiService, bukan dipercaya mentah
    // dari renderer). Permission tulis diambil dari config per-jenis (beda
    // per tabel, mis. 'surat_almari' — BUKAN 'surat_lemari').
    handle('surat:daftarJenis', () => SuratTaksonomiService.daftarJenis())
    handle('surat:list',     (_, jenis, params) => SuratTaksonomiService.list(jenis, params))
    handle('surat:nextKode', (_, jenis) => SuratTaksonomiService.nextKode(jenis))
    handle('surat:create', (_, token, jenis, data) => {
        const auth = AuthService.requirePermission(token, SuratTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? SuratTaksonomiService.create(jenis, data) : { success: false, message: auth.message }
    })
    handle('surat:update', (_, token, jenis, oldKode, data) => {
        const auth = AuthService.requirePermission(token, SuratTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? SuratTaksonomiService.update(jenis, oldKode, data) : { success: false, message: auth.message }
    })
    handle('surat:delete', (_, token, jenis, kode) => {
        const auth = AuthService.requirePermission(token, SuratTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? SuratTaksonomiService.deleteOne(jenis, kode) : { success: false, message: auth.message }
    })

    // File lampiran (MinIO) — lihat MinioService.js. Upload sendiri TIDAK
    // digate permission di sini (belum tentu terkait 1 record spesifik, alur
    // UI-nya upload dulu baru create record-nya) — yang digate permission
    // adalah aksi create/delete record yang MEMAKAI file itu (di bawah).
    handle('file:upload', async (_, objectKey, data, contentType) => {
        try {
            return await MinioService.upload(objectKey, Buffer.from(data), contentType)
        } catch (e) {
            return { success: false, message: 'Gagal upload file: ' + e.message }
        }
    })
    handle('file:getUrl', (_, objectKey) => MinioService.getPresignedUrl(objectKey))

    // Surat Masuk/Keluar — modul PERTAMA hasil porting dari pola hybrid
    // webview (PHP webapps/surat/pages/{input,input2,list,list2}.php) ke
    // native, lihat SuratMasukKeluarService.js & Khanza.md > "Arsitektur
    // Hybrid WebView". Permission 'surat_masuk'/'surat_keluar' — nama asli
    // sik.sql, kebetulan sama persis nama tabelnya.
    handle('surat:masukKeluar:list', (_, jenis, params) => SuratMasukKeluarService.list(jenis, params))
    handle('surat:masukKeluar:nextNoUrut', (_, jenis, tgl) => SuratMasukKeluarService.nextNoUrut(jenis, tgl))
    handle('surat:masukKeluar:create', (_, token, jenis, data) => {
        const auth = AuthService.requirePermission(token, jenis === 'masuk' ? 'surat_masuk' : 'surat_keluar')
        return auth.ok ? SuratMasukKeluarService.create(jenis, data) : { success: false, message: auth.message }
    })
    handle('surat:masukKeluar:delete', (_, token, jenis, noUrut) => {
        const auth = AuthService.requirePermission(token, jenis === 'masuk' ? 'surat_masuk' : 'surat_keluar')
        return auth.ok ? SuratMasukKeluarService.deleteOne(jenis, noUrut) : { success: false, message: auth.message }
    })

    // Toko — MASTER DATA + STOK OPNAME saja (Penjualan/Pembelian/Pemesanan/
    // Piutang/Retur DITUNDA ke Fase 3, semua itu otomatis posting jurnal ke
    // Keuangan yang belum dibangun — lihat Khanza.md section 14 & SOP).
    handle('toko:jenis:list',     (_, params) => TokoJenisService.list(params))
    handle('toko:jenis:nextKode', () => TokoJenisService.nextKode())
    handle('toko:jenis:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_jenis')
        return auth.ok ? TokoJenisService.create(data) : { success: false, message: auth.message }
    })
    handle('toko:jenis:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_jenis')
        return auth.ok ? TokoJenisService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('toko:jenis:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_jenis')
        return auth.ok ? TokoJenisService.deleteOne(kode) : { success: false, message: auth.message }
    })

    handle('toko:suplier:list',     (_, params) => TokoSuplierService.list(params))
    handle('toko:suplier:nextKode', () => TokoSuplierService.nextKode())
    handle('toko:suplier:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_suplier')
        return auth.ok ? TokoSuplierService.create(data) : { success: false, message: auth.message }
    })
    handle('toko:suplier:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_suplier')
        return auth.ok ? TokoSuplierService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('toko:suplier:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_suplier')
        return auth.ok ? TokoSuplierService.deleteOne(kode) : { success: false, message: auth.message }
    })

    handle('toko:member:list',     (_, params) => TokoMemberService.list(params))
    handle('toko:member:nextKode', () => TokoMemberService.nextKode())
    handle('toko:member:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_member')
        return auth.ok ? TokoMemberService.create(data) : { success: false, message: auth.message }
    })
    handle('toko:member:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_member')
        return auth.ok ? TokoMemberService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('toko:member:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_member')
        return auth.ok ? TokoMemberService.deleteOne(kode) : { success: false, message: auth.message }
    })

    handle('toko:barang:list',       (_, params) => TokoBarangService.list(params))
    handle('toko:barang:listSampah', (_, token, params) => {
        // "Data Sampah" cuma boleh dilihat Admin Utama/Administrator —
        // bukan cuma permission toko_barang biasa.
        const session = AuthService.verifySession(token)
        if (!session.success) return { data: [], total: 0 }
        if (!AuthService.isFullAdmin(session.user.role)) return { data: [], total: 0 }
        return TokoBarangService.listSampah(params)
    })
    handle('toko:barang:nextKode', () => TokoBarangService.nextKode())
    handle('toko:barang:calcHarga', (_, beli) => TokoBarangService.calcHarga(beli))
    handle('toko:barang:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_barang')
        return auth.ok ? TokoBarangService.create(data) : { success: false, message: auth.message }
    })
    handle('toko:barang:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_barang')
        return auth.ok ? TokoBarangService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('toko:barang:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_barang')
        return auth.ok ? TokoBarangService.deleteOne(kode) : { success: false, message: auth.message }
    })
    handle('toko:barang:restore', (_, token, kode) => {
        // Replika "Admin Utama only" — bukan cuma permission toko_barang
        // (yang bisa saja dipunya role lain).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh memulihkan data' }
        return TokoBarangService.restore(kode)
    })
    handle('toko:barang:hardDelete', (_, token, kode) => {
        // Replika BtnHapus di DlgRestoreTokoBarang.java — hapus PERMANEN,
        // sama-sama "Admin Utama only" (satu dialog, dua tombol, gate sama).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh menghapus permanen' }
        return TokoBarangService.hardDelete(kode)
    })

    handle('toko:opname:listBarang', (_, params) => TokoOpnameService.listBarangUntukOpname(params))
    handle('toko:opname:list', (_, params) => TokoOpnameService.listOpname(params))
    handle('toko:opname:createBatch', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'stok_opname_toko')
        return auth.ok ? TokoOpnameService.createOpnameBatch({ ...data, petugas: auth.user.username }) : { success: false, message: auth.message }
    })
    handle('toko:opname:delete', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'stok_opname_toko')
        return auth.ok ? TokoOpnameService.deleteOpname(data) : { success: false, message: auth.message }
    })
    handle('toko:riwayat:list', (_, params) => TokoOpnameService.listRiwayat(params))

    // IPSRS — MASTER DATA + Permintaan + Pengajuan + Surat Pemesanan (PO) +
    // Stok Opname + Riwayat saja (Pembelian/Penerimaan/Hibah/Pengeluaran/
    // ReturBeli/Pengambilan UTD DITUNDA ke Fase 3, semua itu posting jurnal
    // ke Keuangan yang belum dibangun — sama prinsipnya dgn Toko di atas).
    handle('ipsrs:jenis:list',    (_, params) => IpsrsJenisService.list(params))
    handle('ipsrs:jenis:listAll', () => IpsrsJenisService.listAll())
    handle('ipsrs:jenis:nextKode', () => IpsrsJenisService.nextKode())
    handle('ipsrs:jenis:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'ipsrs_jenis_barang')
        return auth.ok ? IpsrsJenisService.create(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:jenis:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'ipsrs_jenis_barang')
        return auth.ok ? IpsrsJenisService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('ipsrs:jenis:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'ipsrs_jenis_barang')
        return auth.ok ? IpsrsJenisService.deleteOne(kode) : { success: false, message: auth.message }
    })

    handle('ipsrs:suplier:list',    (_, params) => IpsrsSuplierService.list(params))
    handle('ipsrs:suplier:listAll', () => IpsrsSuplierService.listAll())
    handle('ipsrs:suplier:nextKode', () => IpsrsSuplierService.nextKode())
    handle('ipsrs:suplier:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'suplier_penunjang')
        return auth.ok ? IpsrsSuplierService.create(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:suplier:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'suplier_penunjang')
        return auth.ok ? IpsrsSuplierService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('ipsrs:suplier:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'suplier_penunjang')
        return auth.ok ? IpsrsSuplierService.deleteOne(kode) : { success: false, message: auth.message }
    })

    handle('ipsrs:barang:list',       (_, params) => IpsrsBarangService.list(params))
    handle('ipsrs:barang:nextKode',   () => IpsrsBarangService.nextKode())
    handle('ipsrs:barang:listAktif',  () => IpsrsBarangService.listAktif())
    handle('ipsrs:barang:listSampah', (_, token, params) => {
        // "Data Sampah" cuma boleh dilihat Admin Utama/Administrator — sama
        // pola dgn toko:barang:listSampah.
        const session = AuthService.verifySession(token)
        if (!session.success) return { data: [], total: 0 }
        if (!AuthService.isFullAdmin(session.user.role)) return { data: [], total: 0 }
        return IpsrsBarangService.listSampah(params)
    })
    handle('ipsrs:barang:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'ipsrs_barang')
        return auth.ok ? IpsrsBarangService.create(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:barang:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'ipsrs_barang')
        return auth.ok ? IpsrsBarangService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('ipsrs:barang:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'ipsrs_barang')
        return auth.ok ? IpsrsBarangService.deleteOne(kode) : { success: false, message: auth.message }
    })
    handle('ipsrs:barang:restore', (_, token, kode) => {
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh memulihkan data' }
        return IpsrsBarangService.restore(kode)
    })
    handle('ipsrs:barang:hardDelete', (_, token, kode) => {
        // Replika BtnHapus di DlgRestoreIPSRSBarang.java — hapus PERMANEN.
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh menghapus permanen' }
        return IpsrsBarangService.hardDelete(kode)
    })

    handle('ipsrs:stok:listBarang', (_, params) => IpsrsStokService.listBarangUntukOpname(params))
    handle('ipsrs:stok:list', (_, params) => IpsrsStokService.listOpname(params))
    handle('ipsrs:stok:createBatch', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'stok_opname_logistik')
        return auth.ok ? IpsrsStokService.createOpnameBatch({ ...data, petugas: auth.user.username }) : { success: false, message: auth.message }
    })
    handle('ipsrs:stok:delete', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'stok_opname_logistik')
        return auth.ok ? IpsrsStokService.deleteOpname(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:riwayat:list', (_, params) => IpsrsRiwayatService.list(params))

    handle('ipsrs:permintaan:list',       (_, params) => IpsrsPermintaanService.list(params))
    handle('ipsrs:permintaan:detail',     (_, noPermintaan) => IpsrsPermintaanService.detail(noPermintaan))
    handle('ipsrs:permintaan:nextNomor',  (_, tanggal) => IpsrsPermintaanService.nextNomor(tanggal))
    handle('ipsrs:permintaan:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'permintaan_non_medis')
        return auth.ok ? IpsrsPermintaanService.create(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:permintaan:setStatus', (_, token, noPermintaan, status) => {
        // Replika ppDisetujui/ppTidakDisetujui — gate slug `ipsrs_stok_keluar`
        // (modul Pengeluaran yg dibuka Java asli sesudahnya), BUKAN slug
        // permintaan_non_medis milik modul ini sendiri.
        const auth = AuthService.requirePermission(token, 'ipsrs_stok_keluar')
        return auth.ok ? IpsrsPermintaanService.setStatus(noPermintaan, status) : { success: false, message: auth.message }
    })
    handle('ipsrs:permintaan:delete', (_, token, noPermintaan) => {
        // Replika DlgCariPermintaan.isCek(): ppHapus gate ROLE "Admin Utama"
        // PERSIS (bukan Administrator, bukan permission slug biasa).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (session.user.role !== 'Admin Utama') return { success: false, message: 'Cuma Admin Utama yang boleh menghapus data ini' }
        return IpsrsPermintaanService.deleteOne(noPermintaan)
    })

    handle('ipsrs:pengajuan:list',      (_, params) => IpsrsPengajuanService.list(params))
    handle('ipsrs:pengajuan:detail',    (_, noPengajuan) => IpsrsPengajuanService.detail(noPengajuan))
    handle('ipsrs:pengajuan:nextNomor', (_, tanggal) => IpsrsPengajuanService.nextNomor(tanggal))
    handle('ipsrs:pengajuan:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'pengajuan_barang_nonmedis')
        return auth.ok ? IpsrsPengajuanService.create(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:pengajuan:setStatus', (_, token, noPengajuan, status) => {
        const auth = AuthService.requirePermission(token, 'pengajuan_barang_nonmedis')
        return auth.ok ? IpsrsPengajuanService.setStatus(noPengajuan, status) : { success: false, message: auth.message }
    })
    handle('ipsrs:pengajuan:approve', (_, token, noPengajuan) => {
        // Replika DlgCariPengajuanBarangNonMedis.isCek(): ppDisetujui gate
        // slug SURAT PEMESANAN (`surat_pemesanan_non_medis`) — BEDA dari
        // slug modul ini sendiri, karena approve = langkah awal alur PO.
        const auth = AuthService.requirePermission(token, 'surat_pemesanan_non_medis')
        return auth.ok ? IpsrsPengajuanService.approve(noPengajuan) : { success: false, message: auth.message }
    })
    handle('ipsrs:pengajuan:prefillForSuratPemesanan', (_, noPengajuan) => IpsrsPengajuanService.prefillForSuratPemesanan(noPengajuan))
    handle('ipsrs:pengajuan:delete', (_, token, noPengajuan) => {
        const auth = AuthService.requirePermission(token, 'pengajuan_barang_nonmedis')
        return auth.ok ? IpsrsPengajuanService.deleteOne(noPengajuan) : { success: false, message: auth.message }
    })

    handle('ipsrs:suratPemesanan:list',      (_, params) => IpsrsSuratPemesananService.list(params))
    handle('ipsrs:suratPemesanan:detail',    (_, noPemesanan) => IpsrsSuratPemesananService.detail(noPemesanan))
    handle('ipsrs:suratPemesanan:nextNomor', (_, tanggal) => IpsrsSuratPemesananService.nextNomor(tanggal))
    handle('ipsrs:suratPemesanan:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'surat_pemesanan_non_medis')
        return auth.ok ? IpsrsSuratPemesananService.create(data) : { success: false, message: auth.message }
    })
    handle('ipsrs:suratPemesanan:tandaiProsesPesan', (_, token, noPemesanan) => {
        const auth = AuthService.requirePermission(token, 'surat_pemesanan_non_medis')
        return auth.ok ? IpsrsSuratPemesananService.tandaiProsesPesan(noPemesanan) : { success: false, message: auth.message }
    })
    handle('ipsrs:suratPemesanan:tandaiSudahDatang', (_, token, noPemesanan) => {
        const auth = AuthService.requirePermission(token, 'surat_pemesanan_non_medis')
        return auth.ok ? IpsrsSuratPemesananService.tandaiSudahDatang(noPemesanan) : { success: false, message: auth.message }
    })
    handle('ipsrs:suratPemesanan:delete', (_, token, noPemesanan) => {
        const auth = AuthService.requirePermission(token, 'surat_pemesanan_non_medis')
        return auth.ok ? IpsrsSuratPemesananService.deleteOne(noPemesanan) : { success: false, message: auth.message }
    })

    handle('ipsrs:laporan:rekapPermintaan', (_, params) => IpsrsLaporanService.rekapPermintaan(params))
    handle('ipsrs:laporan:ringkasanPengajuan', (_, params) => IpsrsLaporanService.ringkasanPengajuan(params))
    handle('ipsrs:laporan:ringkasanPemesanan', (_, params) => IpsrsLaporanService.ringkasanPemesanan(params))

    handle('laporan:rl13:get', () => LaporanRlService.rl13())
    handle('laporan:borAlos:get', (_, params) => LaporanRlService.borAlos(params))
    handle('laporan:rl3:get', (_, params) => LaporanRlService.rl3(params))
    handle('laporan:rl4:get', (_, params) => LaporanRlService.rl4(params))
    handle('eeksekutif:landing', () => EEksekutifService.landing())
    handle('eeksekutif:rawatJalan', (_, tgl1, tgl2) => EEksekutifService.rawatJalan(tgl1, tgl2))
    handle('eeksekutif:igd', (_, tgl1, tgl2) => EEksekutifService.igd(tgl1, tgl2))
    handle('eeksekutif:rawatInap', (_, tgl1, tgl2) => EEksekutifService.rawatInap(tgl1, tgl2))
    handle('eeksekutif:lab', (_, tgl1, tgl2) => EEksekutifService.lab(tgl1, tgl2))
    handle('eeksekutif:radiologi', (_, tgl1, tgl2) => EEksekutifService.radiologi(tgl1, tgl2))
    handle('eeksekutif:sisaStokFarmasi', () => EEksekutifService.sisaStokFarmasi())
    handle('eeksekutif:daruratStokFarmasi', () => EEksekutifService.daruratStokFarmasi())
    handle('eeksekutif:kadaluarsaBatchFarmasi', () => EEksekutifService.kadaluarsaBatchFarmasi())
    handle('eeksekutif:ringkasanMutasiFarmasi', (_, tgl1, tgl2, jenisMutasi) => EEksekutifService.ringkasanMutasiFarmasi(tgl1, tgl2, jenisMutasi))
    handle('eeksekutif:ringkasanObatPoliklinik', (_, tgl1, tgl2) => EEksekutifService.ringkasanObatPoliklinik(tgl1, tgl2))
    handle('eeksekutif:ringkasanObatDokter', (_, tgl1, tgl2, statusLanjut) => EEksekutifService.ringkasanObatDokter(tgl1, tgl2, statusLanjut))
    handle('eeksekutif:penerimaanVendorPerBulan', (_, tahun) => EEksekutifService.penerimaanVendorPerBulan(tahun))
    handle('eeksekutif:stokTidakBergerak', (_, bulan) => EEksekutifService.stokTidakBergerak(bulan))
    handle('eeksekutif:sisaStokNonMedis', () => EEksekutifNonMedisService.sisaStokNonMedis())
    handle('eeksekutif:ringkasanMutasiNonMedis', (_, tgl1, tgl2, jenisMutasi) => EEksekutifNonMedisService.ringkasanMutasiNonMedis(tgl1, tgl2, jenisMutasi))
    handle('eeksekutif:penerimaanVendorNonMedisPerBulan', (_, tahun) => EEksekutifNonMedisService.penerimaanVendorNonMedisPerBulan(tahun))
    handle('eeksekutif:sisaStokDapur', () => EEksekutifDapurService.sisaStokDapur())
    handle('eeksekutif:ringkasanMutasiDapur', (_, tgl1, tgl2, jenisMutasi) => EEksekutifDapurService.ringkasanMutasiDapur(tgl1, tgl2, jenisMutasi))
    handle('eeksekutif:penerimaanVendorDapurPerBulan', (_, tahun) => EEksekutifDapurService.penerimaanVendorDapurPerBulan(tahun))
    handle('eeksekutif:mutu:lamaPelayanan', (_, token, tgl1, tgl2, jenis) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifMutuService.lamaPelayanan(tgl1, tgl2, jenis)
    })
    handle('eeksekutif:kasir:pendapatan', (_, token, tgl1, tgl2, jenis) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifKasirService.kasir(tgl1, tgl2, jenis)
    })
    handle('eeksekutif:akuntansi:hutang', (_, token, jenis) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifAkuntansiService.hutang(jenis)
    })
    handle('eeksekutif:akuntansi:piutangBelumLunas', (_, token, jenis) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifAkuntansiService.piutangBelumLunas(jenis)
    })
    handle('eeksekutif:akuntansi:laporanKeuangan', (_, token, tahun) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifAkuntansiService.laporanKeuangan(tahun)
    })
    handle('eeksekutif:akuntansi:rekeningTahun', (_, token, tahun) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifAkuntansiService.rekeningTahun(tahun)
    })
    handle('eeksekutif:akuntansi:saldoAkunPerBulan', (_, token, tahun) => {
        const auth = AuthService.requirePermission(token, 'harian_menejemen')
        if (!auth.ok) throw new Error(auth.message)
        return EEksekutifAkuntansiService.saldoAkunPerBulan(tahun)
    })

    // Keuangan — Master Rekening (COA) & Rekening Tahun
    handle('keuangan:rekening:list', () => KeuanganRekeningService.list())
    handle('keuangan:rekening:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'akun_rekening')
        return auth.ok ? KeuanganRekeningService.create(data) : { success: false, message: auth.message }
    })
    handle('keuangan:rekening:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'akun_rekening')
        return auth.ok ? KeuanganRekeningService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('keuangan:rekening:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'akun_rekening')
        return auth.ok ? KeuanganRekeningService.deleteOne(kode) : { success: false, message: auth.message }
    })
    handle('keuangan:rekeningTahun:list', (_, tahun) => KeuanganRekeningTahunService.list(tahun))
    handle('keuangan:rekeningTahun:save', (_, token, tahun, data) => {
        const auth = AuthService.requirePermission(token, 'rekening_tahun')
        return auth.ok ? KeuanganRekeningTahunService.save(tahun, data) : { success: false, message: auth.message }
    })
    handle('keuangan:pengaturanRekening:get', (_, token) => {
        const auth = AuthService.requirePermission(token, 'pengaturan_rekening')
        if (!auth.ok) throw new Error(auth.message)
        return KeuanganPengaturanRekeningService.getMappingDefault()
    })
    handle('keuangan:pengaturanRekening:save', (_, token, groupKey, data) => {
        const auth = AuthService.requirePermission(token, 'pengaturan_rekening')
        return auth.ok ? KeuanganPengaturanRekeningService.saveMappingDefault(groupKey, data) : { success: false, message: auth.message }
    })

    // Keuangan — Master Akun & Kategori Spasifik (Akun Bayar, Akun Piutang, Kategori Pemasukan/Pengeluaran)
    handle('keuangan:masterAkun:listBayar', () => KeuanganMasterAkunService.listAkunBayar())
    handle('keuangan:masterAkun:createBayar', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'akun_bayar')
        return auth.ok ? KeuanganMasterAkunService.createAkunBayar(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updateBayar', (_, token, oldNama, data) => {
        const auth = AuthService.requirePermission(token, 'akun_bayar')
        return auth.ok ? KeuanganMasterAkunService.updateAkunBayar(oldNama, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deleteBayar', (_, token, nama) => {
        const auth = AuthService.requirePermission(token, 'akun_bayar')
        return auth.ok ? KeuanganMasterAkunService.deleteAkunBayar(nama) : { success: false, message: auth.message }
    })

    handle('keuangan:masterAkun:listPiutang', () => KeuanganMasterAkunService.listAkunPiutang())
    handle('keuangan:masterAkun:createPiutang', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'akun_piutang')
        return auth.ok ? KeuanganMasterAkunService.createAkunPiutang(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updatePiutang', (_, token, oldNama, data) => {
        const auth = AuthService.requirePermission(token, 'akun_piutang')
        return auth.ok ? KeuanganMasterAkunService.updateAkunPiutang(oldNama, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deletePiutang', (_, token, nama) => {
        const auth = AuthService.requirePermission(token, 'akun_piutang')
        return auth.ok ? KeuanganMasterAkunService.deleteAkunPiutang(nama) : { success: false, message: auth.message }
    })

    handle('keuangan:masterAkun:listBayarHutang', () => KeuanganMasterAkunService.listAkunBayarHutang())
    handle('keuangan:masterAkun:createBayarHutang', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'akun_bayar_hutang')
        return auth.ok ? KeuanganMasterAkunService.createAkunBayarHutang(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updateBayarHutang', (_, token, oldNama, data) => {
        const auth = AuthService.requirePermission(token, 'akun_bayar_hutang')
        return auth.ok ? KeuanganMasterAkunService.updateAkunBayarHutang(oldNama, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deleteBayarHutang', (_, token, nama) => {
        const auth = AuthService.requirePermission(token, 'akun_bayar_hutang')
        return auth.ok ? KeuanganMasterAkunService.deleteAkunBayarHutang(nama) : { success: false, message: auth.message }
    })

    handle('keuangan:masterAkun:listAset', () => KeuanganMasterAkunService.listAkunAset())
    handle('keuangan:masterAkun:createAset', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'akun_aset_inventaris')
        return auth.ok ? KeuanganMasterAkunService.createAkunAset(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updateAset', (_, token, oldIdJenis, data) => {
        const auth = AuthService.requirePermission(token, 'akun_aset_inventaris')
        return auth.ok ? KeuanganMasterAkunService.updateAkunAset(oldIdJenis, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deleteAset', (_, token, nama) => {
        const auth = AuthService.requirePermission(token, 'akun_aset_inventaris')
        return auth.ok ? KeuanganMasterAkunService.deleteAkunAset(nama) : { success: false, message: auth.message }
    })

    handle('keuangan:masterAkun:listKategoriPemasukan', () => KeuanganMasterAkunService.listKategoriPemasukan())
    handle('keuangan:masterAkun:createKategoriPemasukan', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'kategori_pemasukan_lain')
        return auth.ok ? KeuanganMasterAkunService.createKategoriPemasukan(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updateKategoriPemasukan', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'kategori_pemasukan_lain')
        return auth.ok ? KeuanganMasterAkunService.updateKategoriPemasukan(oldKode, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deleteKategoriPemasukan', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'kategori_pemasukan_lain')
        return auth.ok ? KeuanganMasterAkunService.deleteKategoriPemasukan(kode) : { success: false, message: auth.message }
    })

    handle('keuangan:masterAkun:listKategoriPengeluaran', () => KeuanganMasterAkunService.listKategoriPengeluaran())
    handle('keuangan:masterAkun:createKategoriPengeluaran', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'kategori_pengeluaran_harian')
        return auth.ok ? KeuanganMasterAkunService.createKategoriPengeluaran(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updateKategoriPengeluaran', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'kategori_pengeluaran_harian')
        return auth.ok ? KeuanganMasterAkunService.updateKategoriPengeluaran(oldKode, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deleteKategoriPengeluaran', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'kategori_pengeluaran_harian')
        return auth.ok ? KeuanganMasterAkunService.deleteKategoriPengeluaran(kode) : { success: false, message: auth.message }
    })

    handle('keuangan:masterAkun:listPenagihanPiutang', () => KeuanganMasterAkunService.listAkunPenagihanPiutang())
    handle('keuangan:masterAkun:createPenagihanPiutang', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'akun_penagihan_piutang')
        return auth.ok ? KeuanganMasterAkunService.createAkunPenagihanPiutang(data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:updatePenagihanPiutang', (_, token, oldKdRek, data) => {
        const auth = AuthService.requirePermission(token, 'akun_penagihan_piutang')
        return auth.ok ? KeuanganMasterAkunService.updateAkunPenagihanPiutang(oldKdRek, data) : { success: false, message: auth.message }
    })
    handle('keuangan:masterAkun:deletePenagihanPiutang', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'akun_penagihan_piutang')
        return auth.ok ? KeuanganMasterAkunService.deleteAkunPenagihanPiutang(kode) : { success: false, message: auth.message }
    })

    handle('keuangan:jurnal:list', (_, params) => KeuanganJurnalService.list(params))
    handle('keuangan:jurnal:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'posting_jurnal')
        return auth.ok ? KeuanganJurnalService.create(data, auth.user.username) : { success: false, message: auth.message }
    })
    handle('keuangan:jurnal:nextNo', (_, tanggal) => KeuanganJurnalService.getNextNoJurnal(tanggal))

    handle('keuangan:jurnalHarian:list', (_, token, params) => {
        const auth = AuthService.requirePermission(token, 'jurnal_harian')
        return auth.ok ? KeuanganJurnalHarianService.list(params) : { rows: [], total_debet: 0, total_kredit: 0, message: auth.message }
    })
    handle('keuangan:jurnalHarian:accounts', (_, token, tahun) => {
        const auth = AuthService.requirePermission(token, 'jurnal_harian')
        return auth.ok ? KeuanganJurnalHarianService.accounts(tahun) : []
    })
    handle('keuangan:bukuBesar:list', (_, params) => KeuanganBukuBesarService.list(params))
    handle('keuangan:bukuBesar:accounts', (_, tahun) => KeuanganBukuBesarService.accounts(tahun))

    // Satuan — SHARED lintas modul (Toko, Dapur, IPSRS, Farmasi, dll di Java
    // asli), lihat SatuanService.js. Namespace 'satuan' sendiri (bukan di
    // bawah 'toko'), biar jelas ini bukan eksklusif Toko.
    handle('satuan:list',     (_, params) => SatuanService.list(params))
    handle('satuan:nextKode', () => SatuanService.nextKode())
    handle('satuan:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'satuan_barang')
        return auth.ok ? SatuanService.create(data) : { success: false, message: auth.message }
    })
    handle('satuan:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'satuan_barang')
        return auth.ok ? SatuanService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('satuan:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'satuan_barang')
        return auth.ok ? SatuanService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — taksonomi (Jenis/Ruang/Pengarang/Kategori), pola generik
    // sama seperti Surat.
    handle('perpustakaan:taksonomi:daftarJenis', () => PerpustakaanTaksonomiService.daftarJenis())
    handle('perpustakaan:taksonomi:list',     (_, jenis, params) => PerpustakaanTaksonomiService.list(jenis, params))
    handle('perpustakaan:taksonomi:nextKode', (_, jenis) => PerpustakaanTaksonomiService.nextKode(jenis))
    handle('perpustakaan:taksonomi:create', (_, token, jenis, data) => {
        const auth = AuthService.requirePermission(token, PerpustakaanTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? PerpustakaanTaksonomiService.create(jenis, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:taksonomi:update', (_, token, jenis, oldKode, data) => {
        const auth = AuthService.requirePermission(token, PerpustakaanTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? PerpustakaanTaksonomiService.update(jenis, oldKode, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:taksonomi:delete', (_, token, jenis, kode) => {
        const auth = AuthService.requirePermission(token, PerpustakaanTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? PerpustakaanTaksonomiService.deleteOne(jenis, kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Penerbit
    handle('perpustakaan:penerbit:list',     (_, params) => PerpustakaanPenerbitService.list(params))
    handle('perpustakaan:penerbit:nextKode', () => PerpustakaanPenerbitService.nextKode())
    handle('perpustakaan:penerbit:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'penerbit_perpustakaan')
        return auth.ok ? PerpustakaanPenerbitService.create(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:penerbit:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'penerbit_perpustakaan')
        return auth.ok ? PerpustakaanPenerbitService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:penerbit:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'penerbit_perpustakaan')
        return auth.ok ? PerpustakaanPenerbitService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Koleksi (katalog buku)
    handle('perpustakaan:koleksi:list',     (_, params) => PerpustakaanKoleksiService.list(params))
    handle('perpustakaan:koleksi:nextKode', () => PerpustakaanKoleksiService.nextKode())
    handle('perpustakaan:koleksi:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'koleksi_perpustakaan')
        return auth.ok ? PerpustakaanKoleksiService.create(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:koleksi:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'koleksi_perpustakaan')
        return auth.ok ? PerpustakaanKoleksiService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:koleksi:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'koleksi_perpustakaan')
        return auth.ok ? PerpustakaanKoleksiService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Anggota
    handle('perpustakaan:anggota:list',     (_, params) => PerpustakaanAnggotaService.list(params))
    handle('perpustakaan:anggota:nextKode', () => PerpustakaanAnggotaService.nextKode())
    handle('perpustakaan:anggota:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'anggota_perpustakaan')
        return auth.ok ? PerpustakaanAnggotaService.create(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:anggota:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'anggota_perpustakaan')
        return auth.ok ? PerpustakaanAnggotaService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:anggota:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'anggota_perpustakaan')
        return auth.ok ? PerpustakaanAnggotaService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Inventaris (eksemplar fisik)
    handle('perpustakaan:inventaris:list',     (_, params) => PerpustakaanInventarisService.list(params))
    handle('perpustakaan:inventaris:summary',  () => PerpustakaanInventarisService.summary())
    handle('perpustakaan:inventaris:nextKode', () => PerpustakaanInventarisService.nextKode())
    handle('perpustakaan:inventaris:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'inventaris_perpustakaan')
        return auth.ok ? PerpustakaanInventarisService.create(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:inventaris:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'inventaris_perpustakaan')
        return auth.ok ? PerpustakaanInventarisService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:inventaris:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'inventaris_perpustakaan')
        return auth.ok ? PerpustakaanInventarisService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Sirkulasi (pinjam/kembali/perpanjang). `nip` (petugas)
    // WAJIB dipilih eksplisit dari dropdown (lihat listPetugas + catatan di
    // PerpustakaanSirkulasiService.js) — TIDAK auto-diambil dari sesi login
    // (koreksi: itu salah, ketahuan lewat FK error nyata saat Admin Utama
    // pakai fitur ini — username login-nya bukan nip asli di tabel `petugas`).
    handle('perpustakaan:sirkulasi:getSetting', () => PerpustakaanSirkulasiService.getSetting())
    handle('perpustakaan:sirkulasi:listPetugas', () => PerpustakaanSirkulasiService.listPetugas())
    handle('perpustakaan:sirkulasi:list', (_, params) => PerpustakaanSirkulasiService.list(params))
    handle('perpustakaan:sirkulasi:previewPinjam', (_, data) => PerpustakaanSirkulasiService.previewPinjam(data))
    handle('perpustakaan:sirkulasi:pinjam', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.pinjam(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:sirkulasi:previewKembali', (_, data) => PerpustakaanSirkulasiService.previewKembali(data))
    handle('perpustakaan:sirkulasi:kembali', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.kembali(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:sirkulasi:perpanjang', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.perpanjang(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:sirkulasi:delete', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.deleteOne(data) : { success: false, message: auth.message }
    })

    // Perpustakaan — Denda (taksonomi jenis denda %)
    handle('perpustakaan:denda:list',     (_, params) => PerpustakaanDendaService.list(params))
    handle('perpustakaan:denda:nextKode', () => PerpustakaanDendaService.nextKode())
    handle('perpustakaan:denda:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'denda_perpustakaan')
        return auth.ok ? PerpustakaanDendaService.create(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:denda:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'denda_perpustakaan')
        return auth.ok ? PerpustakaanDendaService.update(oldKode, data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:denda:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'denda_perpustakaan')
        return auth.ok ? PerpustakaanDendaService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Bayar Denda (2 tabel: harian/lain)
    handle('perpustakaan:bayarDenda:listHarian', (_, params) => PerpustakaanBayarDendaService.listHarian(params))
    handle('perpustakaan:bayarDenda:createHarian', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.createHarian(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:bayarDenda:deleteHarian', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.deleteHarian(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:bayarDenda:listLain', (_, params) => PerpustakaanBayarDendaService.listLain(params))
    handle('perpustakaan:bayarDenda:createLain', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.createLain(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:bayarDenda:deleteLain', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.deleteLain(data) : { success: false, message: auth.message }
    })

    // Perpustakaan — Pengaturan Peminjaman (single-row config). DIGATE ke
    // permission 'set_peminjaman_perpustakaan' meski Java asli TIDAK ada
    // pengecekan akses sama sekali (oversight di kode asli) — deviasi sengaja
    // demi keamanan, lihat komentar di PerpustakaanPengaturanService.js.
    handle('perpustakaan:pengaturan:get', () => PerpustakaanPengaturanService.get())
    handle('perpustakaan:pengaturan:upsert', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'set_peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanPengaturanService.upsert(data) : { success: false, message: auth.message }
    })
    handle('perpustakaan:pengaturan:delete', (_, token) => {
        const auth = AuthService.requirePermission(token, 'set_peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanPengaturanService.deleteSetting() : { success: false, message: auth.message }
    })

    // Migration database — cek status boleh siapa saja yang login (buat
    // nampilin badge "N migrasi tertunda"), tapi EKSEKUSI wajib role
    // Administrator. Dicek DI SINI (server-side/main process), BUKAN cuma
    // disembunyikan tombolnya di UI — renderer bisa saja diutak-atik, jadi
    // token session-nya divalidasi ulang tiap kali sebelum migration jalan.
    handle('db:migrationStatus', () => DatabaseService.getMigrationStatus())

    // PIVOT: tidak ada lagi jalur bootstrap tanpa-login (`db:runInitialMigration`
    // versi lama dihapus) — akun "Admin Utama" (tabel `admin`) sudah ADA di
    // data `sik.sql` sejak awal, jadi TIDAK PERNAH ada kondisi virgin-database
    // yang bikin tidak ada satu pun akun bisa login (lihat README.md > "Login
    // & Permission"). Admin Utama login normal lewat layar Login biasa, lalu
    // migration electron_* dijalankan lewat handler token-gated di bawah ini
    // seperti alur admin biasa — isFullAdmin() meloloskan Admin Utama meski
    // migration electron_* belum pernah jalan sama sekali (AuthService.login
    // tidak bergantung tabel electron_* buat cabang Admin Utama).
    handle('db:runMigrations', (_, token) => {
        const session = AuthService.verifySession(token)
        if (!session.success) {
            return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        }
        if (!AuthService.isFullAdmin(session.user.role)) {
            return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh menjalankan migration' }
        }
        return DatabaseService.runMigrations()
            .then(result => ({ success: true, ...result }))
            .catch(err => ({ success: false, message: err.message }))
    })

    // Pembanding Skema — upload sik.sql baru, bandingkan ke information_schema
    // yang berjalan. Sama seperti migration: gated isFullAdmin, WAJIB backup
    // sebelum apply (lihat SchemaCompareService.js), tidak ada auto-apply.
    handle('schema:compareFile', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.pickAndCompareFile() : { canceled: true, error: auth.message }
    })
    handle('schema:applyTable', (_, token, tableName) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.applyNewTable(tableName) : { success: false, message: auth.message }
    })
    handle('schema:applyColumn', (_, token, table, column, type) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.applyNewColumn(table, column, type) : { success: false, message: auth.message }
    })
    // Cek cakupan permission independen dari upload file — dua arah: kolom
    // `user` LIVE yang belum punya slug (missing), DAN slug yang kolom
    // `user`-nya sudah tidak ada (orphan). Apa pun sebabnya (kolom baru
    // belum di-apply, atau baris electron_permissions kehapus/ketinggalan
    // manual).
    handle('schema:checkPermissionSync', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.checkPermissionSync() : { missing: [], orphan: [] }
    })
    handle('schema:applyPermission', (_, token, slug) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.applyPermission(slug) : { success: false, message: auth.message }
    })
    handle('schema:removeOrphanPermission', (_, token, slug) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.removeOrphanPermission(slug) : { success: false, message: auth.message }
    })

    UpdaterService.init(createWindow())

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
    DatabaseService.close()
})
