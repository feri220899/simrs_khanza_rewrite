// Object storage buat file lampiran (foto/dokumen) — pengganti folder
// `webapps/<modul>/pages/upload/` milik PHP di Khanza asli (lihat Khanza.md
// > "Arsitektur Hybrid WebView" bagian MinIO). Dipegang HANYA main process,
// sama seperti DatabaseService — renderer TIDAK pernah connect langsung ke
// MinIO, cuma lewat IPC (`file:upload`/`file:getUrl`/`file:delete`).
//
// Postgres cuma nyimpan OBJECT KEY-nya (bukan URL permanen/BYTEA) — URL akses
// selalu di-generate on-demand lewat presigned URL berumur pendek.
import { Client } from 'minio'

let client = null
let bucketReady = false

// Diisi lewat configure() dari ConfigService (layar "Pengaturan Awal") —
// sama pola dengan DatabaseService.configure(). Fallback ke process.env
// tetap ada buat kompatibilitas dev lokal (.env).
let overrideConfig = null

function configure(cfg) {
    overrideConfig = cfg
    // Kredensial/endpoint baru — client lama (kalau ada) masih pegang yang
    // lama, tidak bisa "ganti alamat" di tempat.
    client = null
    bucketReady = false
}

// Test 1 client lepas (bukan `client` module-level) — dipakai tombol
// "Cek Koneksi" MinIO di layar Pengaturan Awal.
async function testConnection(cfg) {
    try {
        const testClient = new Client({
            endPoint:  cfg.endpoint, port: Number(cfg.port) || 9000,
            useSSL:    !!cfg.useSSL, accessKey: cfg.accessKey, secretKey: cfg.secretKey,
        })
        await testClient.listBuckets()
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

function getClient() {
    if (!client) {
        const cfg = overrideConfig || {}
        client = new Client({
            endPoint:  cfg.endpoint  || process.env.MINIO_ENDPOINT || 'localhost',
            port:      Number(cfg.port || process.env.MINIO_PORT) || 9000,
            useSSL:    cfg.useSSL ?? (process.env.MINIO_USE_SSL === '1'),
            accessKey: cfg.accessKey || process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: cfg.secretKey || process.env.MINIO_SECRET_KEY || 'minioadmin',
        })
    }
    return client
}

function bucketName() {
    return (overrideConfig && overrideConfig.bucket) || process.env.MINIO_BUCKET || 'khanza'
}

// Idempotent & aman dipanggil bareng dari banyak PC (cuma cek+buat kalau
// belum ada) — pola sama seperti ensureMigrationsTable() di DatabaseService.
async function ensureBucket() {
    if (bucketReady) return
    const c = getClient()
    const bucket = bucketName()
    const exists = await c.bucketExists(bucket).catch(() => false)
    if (!exists) await c.makeBucket(bucket)
    bucketReady = true
}

// `objectKey` sebaiknya sudah mengandung "folder" logis modul asalnya (mis.
// "surat/masuk/<timestamp>-<namafile>") biar gampang ditelusuri dari console
// MinIO — bukan tanggung jawab service ini nentuin konvensi nama, caller yang
// atur (lihat SuratMasukKeluarService.js).
async function upload(objectKey, buffer, contentType) {
    await ensureBucket()
    const c = getClient()
    await c.putObject(bucketName(), objectKey, buffer, buffer.length, contentType ? { 'Content-Type': contentType } : undefined)
    return { success: true, objectKey }
}

async function getPresignedUrl(objectKey, expirySeconds = 900) {
    await ensureBucket()
    const c = getClient()
    return c.presignedGetObject(bucketName(), objectKey, expirySeconds)
}

async function remove(objectKey) {
    await ensureBucket()
    const c = getClient()
    await c.removeObject(bucketName(), objectKey)
}

export default { upload, getPresignedUrl, remove, configure, testConnection }
