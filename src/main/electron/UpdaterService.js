// Porting dari pos-desktop (src/main/electron/UpdaterService.js) — tidak ada
// perubahan logic. Sumber rilis: GitHub Releases repo ini sendiri (lihat
// `publish` di package.json + workflow .github/workflows/rilis.yml), bukan
// server lisensi terpisah kayak pos-desktop.
import electronUpdater from 'electron-updater'
import { app } from 'electron'
import LogService from './LogService.js'

const { autoUpdater } = electronUpdater

let win = null

function send(type, data = {}) {
    if (win && !win.isDestroyed()) win.webContents.send('updater:event', { type, data })
}

function init(mainWindow) {
    win = mainWindow

    // Auto-update hanya di aplikasi terpasang (packaged), bukan mode dev.
    if (!app.isPackaged) return

    autoUpdater.autoDownload = false             // JANGAN unduh otomatis — tunggu keputusan user
    autoUpdater.autoInstallOnAppQuit = true      // kalau sudah terunduh & app ditutup, pasang otomatis

    autoUpdater.on('checking-for-update', ()      => send('checking'))
    autoUpdater.on('update-available',    (info)  => send('available',     { version: info?.version }))
    autoUpdater.on('update-not-available',()      => send('not-available'))
    autoUpdater.on('download-progress',   (p)     => send('progress',      { percent: Math.round(p?.percent ?? 0) }))
    autoUpdater.on('update-downloaded',   (info)  => send('downloaded',     { version: info?.version }))
    // Event ini terjadi di LATAR BELAKANG (bukan hasil panggilan check()/
    // download() langsung), jadi TIDAK lewat wrapper handle() di main/index.js
    // — kalau tidak dicatat manual di sini, error auto-update (mis. GitHub
    // tidak terjangkau) tidak akan pernah masuk log sama sekali.
    autoUpdater.on('error', (err) => {
        LogService.error('Auto-update gagal', { message: String(err?.message ?? err) })
        send('error', { message: String(err?.message ?? err) })
    })

    // Cek saat start (hanya MEMBERI TAHU, tidak mengunduh). Beri jeda agar renderer siap.
    setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}) }, 3000)
}

async function check() {
    if (!app.isPackaged) return { ok: false, reason: 'dev' }
    try {
        const r       = await autoUpdater.checkForUpdates()
        const version = r?.updateInfo?.version
        const current = app.getVersion()
        return { ok: true, available: !!version && version !== current, version, current }
    } catch (e) {
        return { ok: false, error: String(e?.message ?? e) }
    }
}

async function download() {
    if (!app.isPackaged) return { ok: false, reason: 'dev' }
    try {
        await autoUpdater.downloadUpdate()
        return { ok: true }
    } catch (e) {
        return { ok: false, error: String(e?.message ?? e) }
    }
}

function quitAndInstall() {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
}

export default { init, check, download, quitAndInstall }
