// Log ERROR/CRASH LOKAL per-komputer — BEDA dari log aplikasi server (mis.
// Laravel `storage/logs/`) yang terpusat 1 lokasi bisa dibaca semua admin.
// Di sini TIAP KOMPUTER punya file log SENDIRI (app.getPath('userData')),
// tidak ada agregasi terpusat — cukup buat IT lihat "apa yang error di PC
// ini hari ini" saat ada laporan masalah, bukan audit trail lintas-PC.
//
// Retensi SENGAJA cuma hari ini — 1 file per hari (`app-YYYY-MM-DD.log`),
// begitu tanggal berganti file kemarin langsung dihapus (lihat
// cleanupOldLogs()). Tidak pakai library (electron-log dst) — cakupannya
// sempit (error/crash saja, bukan full activity log), fs biasa cukup.
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs'

const logDir = () => join(app.getPath('userData'), 'logs')

function todayStr() {
    return new Date().toISOString().slice(0, 10) // YYYY-MM-DD, lokal cukup UTC-based buat nama file
}

function todayPath() {
    return join(logDir(), `app-${todayStr()}.log`)
}

function ensureDir() {
    const dir = logDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Hapus semua file `app-*.log` SELAIN punya hari ini — dipanggil saat app
// start & tiap kali ada tulisan log baru (murah, cuma baca 1 folder kecil).
function cleanupOldLogs() {
    const dir = logDir()
    if (!existsSync(dir)) return
    const keep = `app-${todayStr()}.log`
    for (const name of readdirSync(dir)) {
        if (name.startsWith('app-') && name.endsWith('.log') && name !== keep) {
            try { unlinkSync(join(dir, name)) } catch { /* biarkan, bukan fatal */ }
        }
    }
}

function write(level, message, meta) {
    try {
        ensureDir()
        cleanupOldLogs()
        const line = `[${new Date().toISOString()}] [${level}] ${message}`
            + (meta ? ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : '')
            + '\n'
        appendFileSync(todayPath(), line, 'utf8')
    } catch {
        // Kalau nulis log sendiri gagal (disk penuh dst), JANGAN sampai
        // melempar error baru — logging tidak boleh jadi sumber crash baru.
    }
}

// Tangkap error yang benar-benar tidak tertangani di main process. SENGAJA
// tidak process.exit() setelahnya — cukup dicatat, aplikasi tetap jalan
// (satu error latar belakang tidak seharusnya menghentikan seluruh sesi
// yang mungkin lagi dipakai buat input data pasien).
function init() {
    ensureDir()
    cleanupOldLogs()
    process.on('uncaughtException', (err) => write('ERROR', 'Uncaught exception (main process)', { message: err?.message, stack: err?.stack }))
    process.on('unhandledRejection', (reason) => write('ERROR', 'Unhandled rejection (main process)', { reason: String(reason?.message ?? reason) }))
}

function error(message, meta) { write('ERROR', message, meta) }
function warn(message, meta) { write('WARN', message, meta) }

function readToday() {
    ensureDir()
    try {
        return { path: todayPath(), content: readFileSync(todayPath(), 'utf8') }
    } catch {
        return { path: todayPath(), content: '' }
    }
}

function clearToday() {
    ensureDir()
    try { writeFileSync(todayPath(), '', 'utf8') } catch { /* biarkan */ }
}

export default { init, error, warn, readToday, clearToday }
