// Awalnya porting langsung dari pos-desktop, TAPI versi itu simpan config
// (termasuk kredensial MySQL/MinIO, token lisensi) sebagai JSON POLOS —
// dikeraskan di sini pakai `safeStorage` bawaan Electron (terikat ke akun OS
// user yang sedang login: DPAPI di Windows, Keychain di Mac, libsecret/
// kwallet di Linux), tidak perlu package tambahan. Ekstensi `.dat` (bukan
// `.json`) sengaja dipakai supaya jelas isinya bukan teks biasa.
//
// Kalau `safeStorage.isEncryptionAvailable()` false (mis. Linux minimal
// tanpa keyring), fallback ke plaintext + `console.warn` — pilihan sadar:
// app tetap bisa dipakai (biar tidak brick di instalasi minim), daripada
// block total karena OS-nya tidak punya backend enkripsi.
import { app, safeStorage, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const configPath = join(app.getPath('userData'), 'config.dat')

function load() {
    if (!existsSync(configPath)) return {}
    try {
        const raw = readFileSync(configPath)
        const json = safeStorage.isEncryptionAvailable()
            ? safeStorage.decryptString(raw)
            : raw.toString('utf8')
        return JSON.parse(json)
    } catch {
        return {}
    }
}

function save(data) {
    const json = JSON.stringify(data, null, 2)
    if (safeStorage.isEncryptionAvailable()) {
        writeFileSync(configPath, safeStorage.encryptString(json))
    } else {
        console.warn('[ConfigService] Enkripsi OS tidak tersedia — config disimpan sebagai teks biasa.')
        writeFileSync(configPath, json, 'utf8')
    }
}

// Export/Import buat instalasi banyak PC di RS yang sama (host/kredensial
// MySQL & MinIO-nya SAMA persis) — supaya IT tidak perlu ngetik manual di
// tiap komputer. SENGAJA TIDAK sekadar salin file `config.dat` mentah:
// isinya dienkripsi `safeStorage` yang terikat ke akun OS + KOMPUTER itu
// (DPAPI Windows, Keychain Mac, dst) — kalau di-copy ke PC lain, tidak akan
// bisa didekripsi sama sekali di sana, walau akun Windows-nya kelihatan
// "sama". Jadi export/import di sini pakai enkripsi TERPISAH berbasis
// passphrase (AES-256-GCM, key dari `scrypt`) yang portable antar komputer
// — passphrase-nya cuma diketik pas export & import, tidak disimpan.
const EXPORT_KEYS = ['db', 'minio']

function deriveKey(passphrase, salt) {
    return scryptSync(passphrase, salt, 32)
}

async function exportToFile(passphrase) {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Konfigurasi Khanza Desktop',
        defaultPath: 'khanza-config.kdconfig',
        filters: [{ name: 'Konfigurasi Khanza Desktop', extensions: ['kdconfig'] }],
    })
    if (canceled || !filePath) return { success: false, message: 'Dibatalkan' }

    const all = load()
    const data = {}
    for (const k of EXPORT_KEYS) if (all[k]) data[k] = all[k]
    if (Object.keys(data).length === 0) {
        return { success: false, message: 'Belum ada konfigurasi MySQL/MinIO yang bisa di-export' }
    }

    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()])
    writeFileSync(filePath, Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]))
    return { success: true, path: filePath }
}

async function importFromFile(passphrase) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Konfigurasi Khanza Desktop',
        filters: [{ name: 'Konfigurasi Khanza Desktop', extensions: ['kdconfig'] }],
        properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return { success: false, message: 'Dibatalkan' }

    try {
        const raw = readFileSync(filePaths[0])
        const salt = raw.subarray(0, 16)
        const iv = raw.subarray(16, 28)
        const authTag = raw.subarray(28, 44)
        const encrypted = raw.subarray(44)
        const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
        decipher.setAuthTag(authTag)
        const data = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'))

        const current = load()
        for (const k of EXPORT_KEYS) if (data[k]) current[k] = data[k]
        save(current)

        return { success: true, data }
    } catch {
        return { success: false, message: 'Gagal import — passphrase salah atau file rusak/bukan file export Khanza Desktop.' }
    }
}

export default {
    get: (key)        => load()[key] ?? null,
    set: (key, value) => { const d = load(); d[key] = value; save(d) },
    exportToFile,
    importFromFile,
}
