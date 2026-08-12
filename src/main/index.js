import 'dotenv/config'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import LisensiService from './electron/LisensiService.js'
import ConfigService  from './electron/ConfigService.js'
import DeviceService  from './electron/DeviceService.js'
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
import MinioService from './electron/MinioService.js'
import TokoJenisService from './db/modules/TokoJenisService.js'
import TokoSuplierService from './db/modules/TokoSuplierService.js'
import TokoMemberService from './db/modules/TokoMemberService.js'
import TokoBarangService from './db/modules/TokoBarangService.js'
import TokoOpnameService from './db/modules/TokoOpnameService.js'
import SatuanService from './db/modules/SatuanService.js'

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
        Menu.setApplicationMenu(null)
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    // Muat config MySQL/MinIO tersimpan (kalau sudah pernah diisi lewat
    // layar "Pengaturan Awal") SEBELUM coba connect apa pun — instalasi baru
    // (belum pernah diisi) akan punya keduanya `null`, dan itu wajar, biarkan
    // saja (lihat blok config:* & catatan DB di bawah).
    const savedDbConfig = ConfigService.get('db')
    if (savedDbConfig) DatabaseService.configure(savedDbConfig)
    const savedMinioConfig = ConfigService.get('minio')
    if (savedMinioConfig) MinioService.configure(savedMinioConfig)

    // Config MySQL/MinIO — WAJIB didaftarkan duluan & TANPA syarat DB nyambung.
    // Ini justru IPC yang dipakai layar "Pengaturan Awal" utk mengisi
    // kredensial itu SAAT DB/MinIO belum bisa dikonek sama sekali (instalasi
    // baru di RS lain, belum ada apa-apa diisi).
    ipcMain.handle('config:isConfigured',   () => !!ConfigService.get('db'))
    ipcMain.handle('config:getDbConfig',    () => ConfigService.get('db'))
    ipcMain.handle('config:saveDbConfig', (_, cfg) => {
        ConfigService.set('db', cfg)
        DatabaseService.configure(cfg)
        return { success: true }
    })
    ipcMain.handle('config:testDbConnection', (_, cfg) => DatabaseService.testConnection(cfg))
    ipcMain.handle('config:getMinioConfig', () => ConfigService.get('minio'))
    ipcMain.handle('config:saveMinioConfig', (_, cfg) => {
        ConfigService.set('minio', cfg)
        MinioService.configure(cfg)
        return { success: true }
    })
    ipcMain.handle('config:testMinioConnection', (_, cfg) => MinioService.testConnection(cfg))

    // Export/Import konfigurasi (lihat catatan panjang di ConfigService.js)
    // — dipakai instalasi banyak PC di RS yang sama biar tidak ngetik ulang
    // manual. Didaftar di sini juga (bukan cuma dalam blok DB nyambung),
    // karena Import dipakai justru SEBELUM DB nyambung (dari layar
    // Pengaturan Awal, PC ke-2 dst yang belum diisi apa-apa).
    ipcMain.handle('config:exportConfig', (_, passphrase) => ConfigService.exportToFile(passphrase))
    ipcMain.handle('config:importConfig', async (_, passphrase) => {
        const result = await ConfigService.importFromFile(passphrase)
        if (result.success) {
            if (result.data.db) DatabaseService.configure(result.data.db)
            if (result.data.minio) MinioService.configure(result.data.minio)
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
    }

    // Lisensi
    ipcMain.handle('lisensi:aktivasi',   (_, key) => LisensiService.aktivasi(key, DeviceService.getId()))
    ipcMain.handle('lisensi:validasi',   (_, key) => LisensiService.validasi(key, DeviceService.getId()))
    ipcMain.handle('lisensi:deaktivasi', (_, key) => LisensiService.deaktivasi(key, DeviceService.getId()))
    ipcMain.handle('lisensi:verifyToken', (_, token) => LisensiService.verifyToken(token))

    // Config lokal generik (dipakai Aktivasi.vue: lisensi_token/license_key)
    ipcMain.handle('config:get', (_, key)        => ConfigService.get(key))
    ipcMain.handle('config:set', (_, key, value) => ConfigService.set(key, value))

    // Device
    ipcMain.handle('device:getId',   () => DeviceService.getId())
    ipcMain.handle('device:getInfo', () => DeviceService.getInfo())

    // App
    ipcMain.handle('app:getVersion', () => app.getVersion())

    // Auth — login ke akun ASLI Khanza (tabel `admin`/`user`), lihat
    // README.md > "Login & Permission (pivot MySQL)". TIDAK ADA ganti-password
    // dari Electron — itu mengubah kredensial produksi RS yang dipakai
    // bareng app Java, sengaja belum digarap (keputusan sengaja, bukan lupa;
    // butuh desain terpisah kalau memang diperlukan nanti).
    ipcMain.handle('auth:login', (_, u, p)  => AuthService.login(u, p))
    ipcMain.handle('auth:me',    (_, token) => AuthService.verifySession(token))

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

    ipcMain.handle('role:list', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listRoles() : []
    })
    ipcMain.handle('role:create', (_, token, nama) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.createRole(nama) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:update', (_, token, id, nama) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.updateRole(id, nama) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:delete', (_, token, id) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.deleteRole(id) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:duplicate', (_, token, id, namaBaru) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.duplicateRole(id, namaBaru) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:permissions:listAll', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listPermissions() : []
    })
    ipcMain.handle('role:permissions:get', (_, token, roleId) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.getRolePermissionIds(roleId) : []
    })
    ipcMain.handle('role:permissions:set', (_, token, roleId, permissionIds) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.setRolePermissions(roleId, permissionIds) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:user:list', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listUserRoleAssignments() : []
    })
    ipcMain.handle('role:user:assign', (_, token, idUser, roleId) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.assignUserRole(idUser, roleId) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:user:remove', (_, token, idUser) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.removeUserRole(idUser) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:user:create', (_, token, data) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.createUserAccount(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('role:user:listOrang', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? RoleService.listOrangUntukUser() : []
    })

    // Parkir (Fase 1 — contoh modul pertama). Baca (list/cek) tidak di-gate
    // permission khusus (sama seperti Java asli — dialognya sendiri yang
    // dibuka lewat menu ber-permission, isi tabelnya terbuka begitu dialog
    // kebuka). Tulis (create/update/delete) DI-GATE server-side ke permission
    // 'parkir_jenis'/'parkir_barcode' — beda dari Java asli yang cuma
    // disable tombolnya di UI (isCek()), di sini dicek ulang tiap request.
    ipcMain.handle('parkir:listJenis',   (_, params) => ParkirService.listJenis(params))
    ipcMain.handle('parkir:nextJenisKode', () => ParkirService.nextJenisKode())
    ipcMain.handle('parkir:createJenis', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_jenis')
        return auth.ok ? ParkirService.createJenis(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('parkir:updateJenis', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_jenis')
        return auth.ok ? ParkirService.updateJenis(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('parkir:deleteJenis', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'parkir_jenis')
        return auth.ok ? ParkirService.deleteJenis(kode) : { success: false, message: auth.message }
    })

    ipcMain.handle('parkir:listBarcode',    (_, params) => ParkirService.listBarcode(params))
    ipcMain.handle('parkir:cekBarcode',     (_, kode) => ParkirService.cekBarcode(kode))
    ipcMain.handle('parkir:nextKartuNomor', () => ParkirService.nextKartuNomor())
    ipcMain.handle('parkir:createBarcode', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_barcode')
        return auth.ok ? ParkirService.createBarcode(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('parkir:updateBarcode', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'parkir_barcode')
        return auth.ok ? ParkirService.updateBarcode(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('parkir:deleteBarcode', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'parkir_barcode')
        return auth.ok ? ParkirService.deleteBarcode(kode) : { success: false, message: auth.message }
    })

    // Surat — 9 tabel taksonomi identik (Rak/Almari/Klasifikasi/Sifat/Map/
    // Indeks/Ruang/Status/Balas), SATU set handler generik diparameterkan
    // `jenis` (di-whitelist di SuratTaksonomiService, bukan dipercaya mentah
    // dari renderer). Permission tulis diambil dari config per-jenis (beda
    // per tabel, mis. 'surat_almari' — BUKAN 'surat_lemari').
    ipcMain.handle('surat:daftarJenis', () => SuratTaksonomiService.daftarJenis())
    ipcMain.handle('surat:list',     (_, jenis, params) => SuratTaksonomiService.list(jenis, params))
    ipcMain.handle('surat:nextKode', (_, jenis) => SuratTaksonomiService.nextKode(jenis))
    ipcMain.handle('surat:create', (_, token, jenis, data) => {
        const auth = AuthService.requirePermission(token, SuratTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? SuratTaksonomiService.create(jenis, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('surat:update', (_, token, jenis, oldKode, data) => {
        const auth = AuthService.requirePermission(token, SuratTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? SuratTaksonomiService.update(jenis, oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('surat:delete', (_, token, jenis, kode) => {
        const auth = AuthService.requirePermission(token, SuratTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? SuratTaksonomiService.deleteOne(jenis, kode) : { success: false, message: auth.message }
    })

    // File lampiran (MinIO) — lihat MinioService.js. Upload sendiri TIDAK
    // digate permission di sini (belum tentu terkait 1 record spesifik, alur
    // UI-nya upload dulu baru create record-nya) — yang digate permission
    // adalah aksi create/delete record yang MEMAKAI file itu (di bawah).
    ipcMain.handle('file:upload', async (_, objectKey, data, contentType) => {
        try {
            return await MinioService.upload(objectKey, Buffer.from(data), contentType)
        } catch (e) {
            return { success: false, message: 'Gagal upload file: ' + e.message }
        }
    })
    ipcMain.handle('file:getUrl', (_, objectKey) => MinioService.getPresignedUrl(objectKey))

    // Surat Masuk/Keluar — modul PERTAMA hasil porting dari pola hybrid
    // webview (PHP webapps/surat/pages/{input,input2,list,list2}.php) ke
    // native, lihat SuratMasukKeluarService.js & Khanza.md > "Arsitektur
    // Hybrid WebView". Permission 'surat_masuk'/'surat_keluar' — nama asli
    // sik.sql, kebetulan sama persis nama tabelnya.
    ipcMain.handle('surat:masukKeluar:list', (_, jenis, params) => SuratMasukKeluarService.list(jenis, params))
    ipcMain.handle('surat:masukKeluar:nextNoUrut', (_, jenis, tgl) => SuratMasukKeluarService.nextNoUrut(jenis, tgl))
    ipcMain.handle('surat:masukKeluar:create', (_, token, jenis, data) => {
        const auth = AuthService.requirePermission(token, jenis === 'masuk' ? 'surat_masuk' : 'surat_keluar')
        return auth.ok ? SuratMasukKeluarService.create(jenis, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('surat:masukKeluar:delete', (_, token, jenis, noUrut) => {
        const auth = AuthService.requirePermission(token, jenis === 'masuk' ? 'surat_masuk' : 'surat_keluar')
        return auth.ok ? SuratMasukKeluarService.deleteOne(jenis, noUrut) : { success: false, message: auth.message }
    })

    // Toko — MASTER DATA + STOK OPNAME saja (Penjualan/Pembelian/Pemesanan/
    // Piutang/Retur DITUNDA ke Fase 3, semua itu otomatis posting jurnal ke
    // Keuangan yang belum dibangun — lihat Khanza.md section 14 & SOP).
    ipcMain.handle('toko:jenis:list',     (_, params) => TokoJenisService.list(params))
    ipcMain.handle('toko:jenis:nextKode', () => TokoJenisService.nextKode())
    ipcMain.handle('toko:jenis:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_jenis')
        return auth.ok ? TokoJenisService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:jenis:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_jenis')
        return auth.ok ? TokoJenisService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:jenis:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_jenis')
        return auth.ok ? TokoJenisService.deleteOne(kode) : { success: false, message: auth.message }
    })

    ipcMain.handle('toko:suplier:list',     (_, params) => TokoSuplierService.list(params))
    ipcMain.handle('toko:suplier:nextKode', () => TokoSuplierService.nextKode())
    ipcMain.handle('toko:suplier:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_suplier')
        return auth.ok ? TokoSuplierService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:suplier:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_suplier')
        return auth.ok ? TokoSuplierService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:suplier:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_suplier')
        return auth.ok ? TokoSuplierService.deleteOne(kode) : { success: false, message: auth.message }
    })

    ipcMain.handle('toko:member:list',     (_, params) => TokoMemberService.list(params))
    ipcMain.handle('toko:member:nextKode', () => TokoMemberService.nextKode())
    ipcMain.handle('toko:member:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_member')
        return auth.ok ? TokoMemberService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:member:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_member')
        return auth.ok ? TokoMemberService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:member:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_member')
        return auth.ok ? TokoMemberService.deleteOne(kode) : { success: false, message: auth.message }
    })

    ipcMain.handle('toko:barang:list',       (_, params) => TokoBarangService.list(params))
    ipcMain.handle('toko:barang:listSampah', (_, token, params) => {
        // "Data Sampah" cuma boleh dilihat Admin Utama/Administrator —
        // bukan cuma permission toko_barang biasa.
        const session = AuthService.verifySession(token)
        if (!session.success) return { data: [], total: 0 }
        if (!AuthService.isFullAdmin(session.user.role)) return { data: [], total: 0 }
        return TokoBarangService.listSampah(params)
    })
    ipcMain.handle('toko:barang:nextKode', () => TokoBarangService.nextKode())
    ipcMain.handle('toko:barang:calcHarga', (_, beli) => TokoBarangService.calcHarga(beli))
    ipcMain.handle('toko:barang:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'toko_barang')
        return auth.ok ? TokoBarangService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:barang:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'toko_barang')
        return auth.ok ? TokoBarangService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:barang:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'toko_barang')
        return auth.ok ? TokoBarangService.deleteOne(kode) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:barang:restore', (_, token, kode) => {
        // Replika "Admin Utama only" — bukan cuma permission toko_barang
        // (yang bisa saja dipunya role lain).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh memulihkan data' }
        return TokoBarangService.restore(kode)
    })
    ipcMain.handle('toko:barang:hardDelete', (_, token, kode) => {
        // Replika BtnHapus di DlgRestoreTokoBarang.java — hapus PERMANEN,
        // sama-sama "Admin Utama only" (satu dialog, dua tombol, gate sama).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (!AuthService.isFullAdmin(session.user.role)) return { success: false, message: 'Cuma Admin Utama/Administrator yang boleh menghapus permanen' }
        return TokoBarangService.hardDelete(kode)
    })

    ipcMain.handle('toko:opname:listBarang', (_, params) => TokoOpnameService.listBarangUntukOpname(params))
    ipcMain.handle('toko:opname:list', (_, params) => TokoOpnameService.listOpname(params))
    ipcMain.handle('toko:opname:createBatch', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'stok_opname_toko')
        return auth.ok ? TokoOpnameService.createOpnameBatch({ ...data, petugas: auth.user.username }) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:opname:delete', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'stok_opname_toko')
        return auth.ok ? TokoOpnameService.deleteOpname(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('toko:riwayat:list', (_, params) => TokoOpnameService.listRiwayat(params))

    // Satuan — SHARED lintas modul (Toko, Dapur, IPSRS, Farmasi, dll di Java
    // asli), lihat SatuanService.js. Namespace 'satuan' sendiri (bukan di
    // bawah 'toko'), biar jelas ini bukan eksklusif Toko.
    ipcMain.handle('satuan:list',     (_, params) => SatuanService.list(params))
    ipcMain.handle('satuan:nextKode', () => SatuanService.nextKode())
    ipcMain.handle('satuan:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'satuan_barang')
        return auth.ok ? SatuanService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('satuan:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'satuan_barang')
        return auth.ok ? SatuanService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('satuan:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'satuan_barang')
        return auth.ok ? SatuanService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — taksonomi (Jenis/Ruang/Pengarang/Kategori), pola generik
    // sama seperti Surat.
    ipcMain.handle('perpustakaan:taksonomi:daftarJenis', () => PerpustakaanTaksonomiService.daftarJenis())
    ipcMain.handle('perpustakaan:taksonomi:list',     (_, jenis, params) => PerpustakaanTaksonomiService.list(jenis, params))
    ipcMain.handle('perpustakaan:taksonomi:nextKode', (_, jenis) => PerpustakaanTaksonomiService.nextKode(jenis))
    ipcMain.handle('perpustakaan:taksonomi:create', (_, token, jenis, data) => {
        const auth = AuthService.requirePermission(token, PerpustakaanTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? PerpustakaanTaksonomiService.create(jenis, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:taksonomi:update', (_, token, jenis, oldKode, data) => {
        const auth = AuthService.requirePermission(token, PerpustakaanTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? PerpustakaanTaksonomiService.update(jenis, oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:taksonomi:delete', (_, token, jenis, kode) => {
        const auth = AuthService.requirePermission(token, PerpustakaanTaksonomiService.getConfig(jenis).permission)
        return auth.ok ? PerpustakaanTaksonomiService.deleteOne(jenis, kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Penerbit
    ipcMain.handle('perpustakaan:penerbit:list',     (_, params) => PerpustakaanPenerbitService.list(params))
    ipcMain.handle('perpustakaan:penerbit:nextKode', () => PerpustakaanPenerbitService.nextKode())
    ipcMain.handle('perpustakaan:penerbit:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'penerbit_perpustakaan')
        return auth.ok ? PerpustakaanPenerbitService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:penerbit:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'penerbit_perpustakaan')
        return auth.ok ? PerpustakaanPenerbitService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:penerbit:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'penerbit_perpustakaan')
        return auth.ok ? PerpustakaanPenerbitService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Koleksi (katalog buku)
    ipcMain.handle('perpustakaan:koleksi:list',     (_, params) => PerpustakaanKoleksiService.list(params))
    ipcMain.handle('perpustakaan:koleksi:nextKode', () => PerpustakaanKoleksiService.nextKode())
    ipcMain.handle('perpustakaan:koleksi:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'koleksi_perpustakaan')
        return auth.ok ? PerpustakaanKoleksiService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:koleksi:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'koleksi_perpustakaan')
        return auth.ok ? PerpustakaanKoleksiService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:koleksi:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'koleksi_perpustakaan')
        return auth.ok ? PerpustakaanKoleksiService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Anggota
    ipcMain.handle('perpustakaan:anggota:list',     (_, params) => PerpustakaanAnggotaService.list(params))
    ipcMain.handle('perpustakaan:anggota:nextKode', () => PerpustakaanAnggotaService.nextKode())
    ipcMain.handle('perpustakaan:anggota:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'anggota_perpustakaan')
        return auth.ok ? PerpustakaanAnggotaService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:anggota:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'anggota_perpustakaan')
        return auth.ok ? PerpustakaanAnggotaService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:anggota:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'anggota_perpustakaan')
        return auth.ok ? PerpustakaanAnggotaService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Inventaris (eksemplar fisik)
    ipcMain.handle('perpustakaan:inventaris:list',     (_, params) => PerpustakaanInventarisService.list(params))
    ipcMain.handle('perpustakaan:inventaris:summary',  () => PerpustakaanInventarisService.summary())
    ipcMain.handle('perpustakaan:inventaris:nextKode', () => PerpustakaanInventarisService.nextKode())
    ipcMain.handle('perpustakaan:inventaris:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'inventaris_perpustakaan')
        return auth.ok ? PerpustakaanInventarisService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:inventaris:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'inventaris_perpustakaan')
        return auth.ok ? PerpustakaanInventarisService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:inventaris:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'inventaris_perpustakaan')
        return auth.ok ? PerpustakaanInventarisService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Sirkulasi (pinjam/kembali/perpanjang). `nip` (petugas)
    // WAJIB dipilih eksplisit dari dropdown (lihat listPetugas + catatan di
    // PerpustakaanSirkulasiService.js) — TIDAK auto-diambil dari sesi login
    // (koreksi: itu salah, ketahuan lewat FK error nyata saat Admin Utama
    // pakai fitur ini — username login-nya bukan nip asli di tabel `petugas`).
    ipcMain.handle('perpustakaan:sirkulasi:getSetting', () => PerpustakaanSirkulasiService.getSetting())
    ipcMain.handle('perpustakaan:sirkulasi:listPetugas', () => PerpustakaanSirkulasiService.listPetugas())
    ipcMain.handle('perpustakaan:sirkulasi:list', (_, params) => PerpustakaanSirkulasiService.list(params))
    ipcMain.handle('perpustakaan:sirkulasi:previewPinjam', (_, data) => PerpustakaanSirkulasiService.previewPinjam(data))
    ipcMain.handle('perpustakaan:sirkulasi:pinjam', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.pinjam(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:sirkulasi:previewKembali', (_, data) => PerpustakaanSirkulasiService.previewKembali(data))
    ipcMain.handle('perpustakaan:sirkulasi:kembali', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.kembali(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:sirkulasi:perpanjang', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.perpanjang(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:sirkulasi:delete', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.deleteOne(data) : { success: false, message: auth.message }
    })

    // Perpustakaan — Denda (taksonomi jenis denda %)
    ipcMain.handle('perpustakaan:denda:list',     (_, params) => PerpustakaanDendaService.list(params))
    ipcMain.handle('perpustakaan:denda:nextKode', () => PerpustakaanDendaService.nextKode())
    ipcMain.handle('perpustakaan:denda:create', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'denda_perpustakaan')
        return auth.ok ? PerpustakaanDendaService.create(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:denda:update', (_, token, oldKode, data) => {
        const auth = AuthService.requirePermission(token, 'denda_perpustakaan')
        return auth.ok ? PerpustakaanDendaService.update(oldKode, data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:denda:delete', (_, token, kode) => {
        const auth = AuthService.requirePermission(token, 'denda_perpustakaan')
        return auth.ok ? PerpustakaanDendaService.deleteOne(kode) : { success: false, message: auth.message }
    })

    // Perpustakaan — Bayar Denda (2 tabel: harian/lain)
    ipcMain.handle('perpustakaan:bayarDenda:listHarian', (_, params) => PerpustakaanBayarDendaService.listHarian(params))
    ipcMain.handle('perpustakaan:bayarDenda:createHarian', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.createHarian(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:bayarDenda:deleteHarian', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.deleteHarian(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:bayarDenda:listLain', (_, params) => PerpustakaanBayarDendaService.listLain(params))
    ipcMain.handle('perpustakaan:bayarDenda:createLain', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.createLain(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:bayarDenda:deleteLain', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'bayar_denda_perpustakaan')
        return auth.ok ? PerpustakaanBayarDendaService.deleteLain(data) : { success: false, message: auth.message }
    })

    // Perpustakaan — Pengaturan Peminjaman (single-row config). DIGATE ke
    // permission 'set_peminjaman_perpustakaan' meski Java asli TIDAK ada
    // pengecekan akses sama sekali (oversight di kode asli) — deviasi sengaja
    // demi keamanan, lihat komentar di PerpustakaanPengaturanService.js.
    ipcMain.handle('perpustakaan:pengaturan:get', () => PerpustakaanPengaturanService.get())
    ipcMain.handle('perpustakaan:pengaturan:upsert', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'set_peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanPengaturanService.upsert(data) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:pengaturan:delete', (_, token) => {
        const auth = AuthService.requirePermission(token, 'set_peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanPengaturanService.deleteSetting() : { success: false, message: auth.message }
    })

    // Migration database — cek status boleh siapa saja yang login (buat
    // nampilin badge "N migrasi tertunda"), tapi EKSEKUSI wajib role
    // Administrator. Dicek DI SINI (server-side/main process), BUKAN cuma
    // disembunyikan tombolnya di UI — renderer bisa saja diutak-atik, jadi
    // token session-nya divalidasi ulang tiap kali sebelum migration jalan.
    ipcMain.handle('db:migrationStatus', () => DatabaseService.getMigrationStatus())

    // PIVOT: tidak ada lagi jalur bootstrap tanpa-login (`db:runInitialMigration`
    // versi lama dihapus) — akun "Admin Utama" (tabel `admin`) sudah ADA di
    // data `sik.sql` sejak awal, jadi TIDAK PERNAH ada kondisi virgin-database
    // yang bikin tidak ada satu pun akun bisa login (lihat README.md > "Login
    // & Permission"). Admin Utama login normal lewat layar Login biasa, lalu
    // migration electron_* dijalankan lewat handler token-gated di bawah ini
    // seperti alur admin biasa — isFullAdmin() meloloskan Admin Utama meski
    // migration electron_* belum pernah jalan sama sekali (AuthService.login
    // tidak bergantung tabel electron_* buat cabang Admin Utama).
    ipcMain.handle('db:runMigrations', (_, token) => {
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
    ipcMain.handle('schema:compareFile', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.pickAndCompareFile() : { canceled: true, error: auth.message }
    })
    ipcMain.handle('schema:applyTable', (_, token, tableName) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.applyNewTable(tableName) : { success: false, message: auth.message }
    })
    ipcMain.handle('schema:applyColumn', (_, token, table, column, type) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.applyNewColumn(table, column, type) : { success: false, message: auth.message }
    })
    // Cek cakupan permission independen dari upload file — dua arah: kolom
    // `user` LIVE yang belum punya slug (missing), DAN slug yang kolom
    // `user`-nya sudah tidak ada (orphan). Apa pun sebabnya (kolom baru
    // belum di-apply, atau baris electron_permissions kehapus/ketinggalan
    // manual).
    ipcMain.handle('schema:checkPermissionSync', (_, token) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.checkPermissionSync() : { missing: [], orphan: [] }
    })
    ipcMain.handle('schema:applyPermission', (_, token, slug) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.applyPermission(slug) : { success: false, message: auth.message }
    })
    ipcMain.handle('schema:removeOrphanPermission', (_, token, slug) => {
        const auth = requireFullAdmin(token)
        return auth.ok ? SchemaCompareService.removeOrphanPermission(slug) : { success: false, message: auth.message }
    })

    createWindow()

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
