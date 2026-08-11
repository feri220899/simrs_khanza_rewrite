import 'dotenv/config'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import LisensiService from './electron/LisensiService.js'
import ConfigService  from './electron/ConfigService.js'
import DeviceService  from './electron/DeviceService.js'
import AuthService    from './db/AuthService.js'
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
    // Cuma connect + pastikan tabel `migrations` ada — TIDAK menjalankan
    // migration apa pun di sini (lihat catatan panjang di DatabaseService.js
    // > runMigrations()). App ini di-install di banyak PC RS sekaligus;
    // migration schema WAJIB dipicu manual sekali oleh Administrator (lewat
    // IPC db:runMigrations di bawah, atau `npm run migrate` dari CLI),
    // bukan otomatis tiap PC nyala.
    try {
        await DatabaseService.get()
    } catch (err) {
        console.error('Gagal konek ke database:', err.message)
        app.quit()
        return
    }

    // Lisensi
    ipcMain.handle('lisensi:aktivasi',   (_, key) => LisensiService.aktivasi(key, DeviceService.getId()))
    ipcMain.handle('lisensi:validasi',   (_, key) => LisensiService.validasi(key, DeviceService.getId()))
    ipcMain.handle('lisensi:deaktivasi', (_, key) => LisensiService.deaktivasi(key, DeviceService.getId()))
    ipcMain.handle('lisensi:verifyToken', (_, token) => LisensiService.verifyToken(token))

    // Config lokal
    ipcMain.handle('config:get', (_, key)        => ConfigService.get(key))
    ipcMain.handle('config:set', (_, key, value) => ConfigService.set(key, value))

    // Device
    ipcMain.handle('device:getId',   () => DeviceService.getId())
    ipcMain.handle('device:getInfo', () => DeviceService.getInfo())

    // App
    ipcMain.handle('app:getVersion', () => app.getVersion())

    // Auth
    ipcMain.handle('auth:login',          (_, u, p)        => AuthService.login(u, p))
    ipcMain.handle('auth:me',             (_, token)       => AuthService.verifySession(token))
    ipcMain.handle('auth:changePassword', (_, t, oldPw, newPw) => AuthService.changePassword(t, oldPw, newPw))

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
        // "Data Sampah" cuma boleh dilihat Administrator (Admin Utama di
        // Java asli) — bukan cuma permission toko_barang biasa.
        const session = AuthService.verifySession(token)
        if (!session.success) return { data: [], total: 0 }
        if (session.user.role !== 'Administrator') return { data: [], total: 0 }
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
        // Replika "Admin Utama only" — role Administrator secara eksplisit,
        // bukan cuma permission toko_barang (yang bisa saja dipunya role lain).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (session.user.role !== 'Administrator') return { success: false, message: 'Cuma Administrator yang boleh memulihkan data' }
        return TokoBarangService.restore(kode)
    })
    ipcMain.handle('toko:barang:hardDelete', (_, token, kode) => {
        // Replika BtnHapus di DlgRestoreTokoBarang.java — hapus PERMANEN,
        // sama-sama "Admin Utama only" (satu dialog, dua tombol, gate sama).
        const session = AuthService.verifySession(token)
        if (!session.success) return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        if (session.user.role !== 'Administrator') return { success: false, message: 'Cuma Administrator yang boleh menghapus permanen' }
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

    // Perpustakaan — Sirkulasi (pinjam/kembali/perpanjang) — nip diambil dari
    // sesi yang login (server-side), bukan dipercaya mentah dari form, biar
    // tidak bisa dipalsukan jadi nama petugas lain.
    ipcMain.handle('perpustakaan:sirkulasi:getSetting', () => PerpustakaanSirkulasiService.getSetting())
    ipcMain.handle('perpustakaan:sirkulasi:list', (_, params) => PerpustakaanSirkulasiService.list(params))
    ipcMain.handle('perpustakaan:sirkulasi:previewPinjam', (_, data) => PerpustakaanSirkulasiService.previewPinjam(data))
    ipcMain.handle('perpustakaan:sirkulasi:pinjam', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.pinjam({ ...data, nip: auth.user.username }) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:sirkulasi:previewKembali', (_, data) => PerpustakaanSirkulasiService.previewKembali(data))
    ipcMain.handle('perpustakaan:sirkulasi:kembali', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.kembali({ ...data, nip: auth.user.username }) : { success: false, message: auth.message }
    })
    ipcMain.handle('perpustakaan:sirkulasi:perpanjang', (_, token, data) => {
        const auth = AuthService.requirePermission(token, 'peminjaman_perpustakaan')
        return auth.ok ? PerpustakaanSirkulasiService.perpanjang({ ...data, nip: auth.user.username }) : { success: false, message: auth.message }
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

    // Bootstrap instalasi pertama — TANPA token. Sengaja dikecualikan dari
    // gate Administrator, tapi HANYA kalau `applied.length === 0` (database
    // benar-benar virgin, belum ada migrasi SATU PUN yang pernah jalan).
    // Alasan: di kondisi itu memang belum mungkin ada Administrator yang bisa
    // login sama sekali (chicken-and-egg, lihat Khanza.md > "Bootstrap
    // instalasi pertama") — jadi mensyaratkan auth di sini justru bikin
    // sistem tidak bisa di-setup sama sekali tanpa buka terminal.
    // Begitu ada satu migrasi yang jalan (lewat jalur ini ATAUPUN `npm run
    // migrate`), jalur ini otomatis terkunci lagi — migrasi berikutnya WAJIB
    // lewat db:runMigrations (bawah ini) yang di-gate token Administrator.
    ipcMain.handle('db:runInitialMigration', async () => {
        const status = await DatabaseService.getMigrationStatus()
        if (status.applied.length > 0) {
            return { success: false, message: 'Sistem sudah pernah di-setup sebagian — gunakan tombol migrasi di Pengaturan dengan akun Administrator, atau `npm run migrate` dari CLI.' }
        }
        return DatabaseService.runMigrations()
            .then(result => ({ success: true, ...result }))
            .catch(err => ({ success: false, message: err.message }))
    })

    ipcMain.handle('db:runMigrations', (_, token) => {
        const session = AuthService.verifySession(token)
        if (!session.success) {
            return { success: false, message: 'Sesi tidak valid, silakan login ulang' }
        }
        if (session.user.role !== 'Administrator') {
            return { success: false, message: 'Cuma Administrator yang boleh menjalankan migration' }
        }
        return DatabaseService.runMigrations()
            .then(result => ({ success: true, ...result }))
            .catch(err => ({ success: false, message: err.message }))
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
