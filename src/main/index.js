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
    // Migration Postgres dijalankan sekali di sini saat app start (lihat
    // DatabaseService.get() -> runMigrations()). Kalau gagal, app SENGAJA
    // tidak lanjut buka window — jangan biarkan user masuk ke app dengan
    // skema DB yang belum tentu benar.
    try {
        await DatabaseService.get()
    } catch (err) {
        console.error('Gagal konek/migrasi database:', err.message)
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

    // Parkir (Fase 1 — contoh modul pertama)
    ipcMain.handle('parkir:listJenis',       ()        => ParkirService.listJenis())
    ipcMain.handle('parkir:cekBarcode',      (_, kode) => ParkirService.cekBarcode(kode))

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
