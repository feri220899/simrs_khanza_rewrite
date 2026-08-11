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

function getClient() {
    if (!client) {
        client = new Client({
            endPoint:  process.env.MINIO_ENDPOINT || 'localhost',
            port:      Number(process.env.MINIO_PORT) || 9000,
            useSSL:    process.env.MINIO_USE_SSL === '1',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        })
    }
    return client
}

function bucketName() {
    return process.env.MINIO_BUCKET || 'khanza'
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

export default { upload, getPresignedUrl, remove }
