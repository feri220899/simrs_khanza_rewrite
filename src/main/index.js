import 'dotenv/config'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import LisensiService from './electron/LisensiService.js'
import ConfigService  from './electron/ConfigService.js'
import DeviceService  from './electron/DeviceService.js'
import AuthService    from './db/AuthService.js'
import DatabaseService from './db/DatabaseService.js'
import ParkirService  from './db/modules/ParkirService.js'

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
