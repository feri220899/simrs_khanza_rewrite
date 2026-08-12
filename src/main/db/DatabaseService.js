// PIVOT (lihat Khanza.md > "Prinsip Migrasi Data"): backend pindah dari Postgres
// ke MySQL, connect ke database `sik` YANG SAMA PERSIS dengan app Java asli
// (bukan lagi database Postgres terpisah) — tidak ada Express/API perantara,
// tiap komputer klien connect langsung (lihat "Arsitektur UI & Koneksi Data").
//
// `pool` di bawah ini SENGAJA dibungkus (bukan langsung `mysql2` Pool apa
// adanya) supaya permukaan API-nya (`db.query()` balikin `{rows}`, `db.connect()`
// balikin client dengan `.query()`/`.release()`) TETAP SAMA seperti pola pg
// lama yang sudah dipakai di seluruh service (`AuthService.js`, migration
// files, dst) — jadi migrasi driver ini tidak memaksa tulis ulang SETIAP file
// yang query DB sekaligus. Yang WAJIB disesuaikan per-file tetap ada
// (placeholder `$1`→`?`, fungsi khusus Postgres kayak `array_agg`/`now()`
// case-sensitive dst) — itu dikerjakan bertahap per modul, bukan di sini.
import mysql from 'mysql2/promise'
import migrations from './migrations/index.js'

let pool = null

// Bungkus PoolConnection (dari `rawPool.getConnection()`) supaya bentuknya
// sama seperti `pg` Client: `.query(sql, params)` balikin `{rows}` (bukan
// tuple `[rows, fields]`), dan `.release()` tetap ada.
function wrapConnection(conn) {
    return {
        query: async (sql, params) => {
            const [rows] = await conn.query(sql, params)
            return { rows }
        },
        release: () => conn.release(),
    }
}

function connect() {
    if (pool) return pool

    const rawPool = mysql.createPool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT) || 3306,
        database: process.env.DB_DATABASE || 'sik',
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        waitForConnections: true,
        connectionLimit: 10,
        // Cuma kolom DATE murni yang dipaksa balik sebagai string 'YYYY-MM-DD'
        // (dipakai renderer Vue langsung di <input type="date"> v-model, dst) —
        // DATETIME/TIMESTAMP dibiarkan default (balik sebagai Date), sama
        // prinsipnya dengan override type parser OID 1082 di versi pg lama.
        dateStrings: ['DATE'],
    })

    pool = {
        query: async (sql, params) => {
            const [rows] = await rawPool.query(sql, params)
            return { rows }
        },
        connect: async () => wrapConnection(await rawPool.getConnection()),
        end: () => rawPool.end(),
    }

    return pool
}

// Cuma bikin tabel tracking-nya kalau belum ada — idempotent & aman dipanggil
// dari banyak PC sekaligus (CREATE TABLE IF NOT EXISTS). TIDAK menjalankan
// migration apa pun. Dipanggil setiap app boot (lewat get()) supaya
// getMigrationStatus() selalu bisa jalan, termasuk di instalasi yang benar-benar baru.
async function ensureMigrationsTable() {
    const db = connect()
    await db.query(`
        CREATE TABLE IF NOT EXISTS electron_migrations (
            name    VARCHAR(255) PRIMARY KEY,
            ran_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `)
    return db
}

// Cek status TANPA menjalankan apa pun — dipakai buat nampilin badge/tombol
// di Pengaturan ("N migrasi tertunda") sebelum Administrator memutuskan klik
// "Jalankan Migration".
async function getMigrationStatus() {
    const db = await ensureMigrationsTable()
    const { rows } = await db.query('SELECT name FROM electron_migrations')
    const applied = rows.map(r => r.name)
    const pending = migrations.filter(m => !applied.includes(m.name)).map(m => m.name)
    return { applied, pending, upToDate: pending.length === 0 }
}

// PENTING: fungsi ini SENGAJA TIDAK dipanggil otomatis saat app start (lihat
// main/index.js). Aplikasi ini di-install di banyak komputer RS sekaligus —
// kalau migration jalan otomatis tiap boot, beberapa PC bisa mencoba
// menjalankan migration yang sama ke MySQL terpusat yang sama secara
// bersamaan (race condition), atau migration destruktif kejalanan tanpa ada
// yang sadar/mengawasi. Migration cuma boleh dipicu MANUAL oleh Administrator
// — lewat tombol di Pengaturan (IPC 'db:runMigrations', dicek role-nya di
// server/main process, bukan cuma disembunyikan di UI) atau `npm run migrate`
// dari command line buat cek ke staging dulu.
async function runMigrations() {
    const db = await ensureMigrationsTable()

    const { rows } = await db.query('SELECT name FROM electron_migrations')
    const ran     = rows.map(r => r.name)
    const pending = migrations.filter(m => !ran.includes(m.name))
    if (pending.length === 0) return { ranCount: 0, names: [] }

    // TIDAK ADA backup otomatis dari app ini (keputusan sengaja) — backup
    // database `sik` sudah jadi tanggung jawab rutin DBA/infra RS di sisi
    // server (mysqldump/snapshot terjadwal), bukan sesuatu yang dipicu dari
    // sini. UI (Pengaturan > Database > Migrasi) WAJIB tetap tegaskan lewat
    // konfirmasi eksplisit bahwa backup manual harus sudah dilakukan sebelum
    // klik jalankan — lihat MigrationPanel.vue.
    for (const { name, up } of pending) {
        const client = await db.connect()
        try {
            await client.query('START TRANSACTION')
            await up(client)
            await client.query('INSERT INTO electron_migrations (name) VALUES (?)', [name])
            await client.query('COMMIT')
        } catch (err) {
            await client.query('ROLLBACK')
            throw new Error(`[migrasi] gagal menjalankan ${name}: ${err.message}`)
        } finally {
            client.release()
        }
    }

    return { ranCount: pending.length, names: pending.map(m => m.name) }
}

async function get() {
    if (!pool) connect()
    // SENGAJA cuma ensureMigrationsTable(), BUKAN runMigrations() — lihat
    // catatan panjang di atas runMigrations(). Setiap PC yang buka app tidak
    // boleh diam-diam mengubah skema database bersama.
    await ensureMigrationsTable()
    return pool
}

async function close() {
    if (pool) {
        await pool.end()
        pool = null
    }
}

export default { connect, get, runMigrations, getMigrationStatus, close }
