// Cache generik berbasis Redis TERPUSAT — pengganti mekanisme cache file
// manual Khanza asli (file `.iyem` di folder `cache/` + `Valid.daysOld()`
// buat gerbang TTL, lihat pola `tampil()`/`tampil2()` di ratusan dialog
// "Cari..." dan 10 fungsi lookup di `src/fungsi/sekuel.java`).
//
// SENGAJA baru infrastruktur dasar (get/set dengan TTL) — keputusan eksplisit
// buat TIDAK sekalian bikin fungsi lookup spesifik (CariDokter/CariPetugas/
// dst, pengganti sekuel.java) atau cache lintas-modul (`akunbayar.iyem` dkk)
// di sini. Itu menyusul belakangan, dipasang BARENG modul yang benar-benar
// memakainya (mis. saat Toko transaksi/Kasir digarap di Fase 3) — supaya
// tidak bangun cache buat sesuatu yang belum ada pemakainya.
//
// Cache SIFATNYA OPSIONAL/BEST-EFFORT — beda dari DatabaseService (WAJIB
// nyambung, app tidak bisa jalan tanpa MySQL). Kalau Redis mati/belum
// disetup, get()/set()/del() di sini TIDAK PERNAH throw — cukup dianggap
// "cache miss", caller tetap fallback ke query DB biasa seperti kalau cache
// tidak ada sama sekali.
import Redis from 'ioredis'

let client = null
let overrideConfig = null

function configure(cfg) {
    overrideConfig = cfg
    if (client) {
        const old = client
        client = null
        old.disconnect()
    }
}

function getClient() {
    if (!client) {
        const cfg = overrideConfig || {}
        client = new Redis({
            host:     cfg.host     || process.env.REDIS_HOST     || 'localhost',
            port:     Number(cfg.port || process.env.REDIS_PORT) || 6379,
            password: cfg.password || process.env.REDIS_PASSWORD || undefined,
            db:       Number(cfg.db ?? process.env.REDIS_DB ?? 0),
            // `enableOfflineQueue` DIBIARKAN default (true) — kalau false,
            // command yang dikirim SESAAT setelah configure()/getClient()
            // (sebelum koneksi TCP awal selesai handshake) langsung gagal
            // walau Redis-nya benar & hidup (kepancing pas tes: set/get
            // gagal terus meski konfigurasinya benar). Dengan default true,
            // command diantre sebentar sampai koneksi awal selesai (biasa
            // cuma hitungan milidetik), BUKAN antre lama nungguin reconnect.
            // `maxRetriesPerRequest` kecil tetap dipertahankan supaya kalau
            // Redis BENERAN tidak terjangkau, command tetap gagal cepat
            // (tidak menggantung lama) — cache ini best-effort, bukan wajib.
            maxRetriesPerRequest: 2,
        })
        // Diam-diamkan — kalau tidak, tiap gagal reconnect nge-print stack
        // trace ke console. Kegagalan tetap kelihatan lewat try/catch di
        // get()/set()/del() di bawah, bukan lewat log ribut di sini.
        client.on('error', () => {})
    }
    return client
}

// Test 1 koneksi lepas (bukan `client` module-level) — dipakai tombol
// "Cek Koneksi" Redis di layar Environment, sama pola dengan
// DatabaseService.testConnection()/MinioService.testConnection().
async function testConnection(cfg) {
    let testClient
    try {
        testClient = new Redis({
            host: cfg.host, port: Number(cfg.port) || 6379,
            password: cfg.password || undefined, db: Number(cfg.db ?? 0),
            lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null,
            connectTimeout: 5000,
        })
        testClient.on('error', () => {}) // diam-diamkan — kegagalan tetap ditangkap lewat try/catch di bawah
        await testClient.connect()
        await testClient.ping()
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    } finally {
        if (testClient) testClient.disconnect()
    }
}

async function get(key) {
    try {
        const raw = await getClient().get(key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

// `ttlSeconds` opsional — tanpa itu key tidak pernah expire sendiri (beda
// dari pola Khanza asli yang SELALU ada TTL, jadi biasakan selalu isi TTL
// kecuali memang sengaja permanen).
async function set(key, value, ttlSeconds) {
    try {
        const json = JSON.stringify(value)
        if (ttlSeconds) await getClient().set(key, json, 'EX', ttlSeconds)
        else await getClient().set(key, json)
        return true
    } catch {
        return false
    }
}

async function del(key) {
    try {
        await getClient().del(key)
        return true
    } catch {
        return false
    }
}

export default { configure, testConnection, get, set, del }
