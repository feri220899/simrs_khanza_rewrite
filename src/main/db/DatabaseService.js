// BEDA UTAMA dari referensi pos-desktop: referensi pakai better-sqlite3 (1 file
// SQLite lokal per device, offline-first). Khanza-desktop pakai Postgres TERPUSAT
// yang di-hit LANGSUNG oleh tiap komputer klien (tidak ada Express/API perantara —
// lihat Khanza.md > "Arsitektur UI & Koneksi Data"). Konsekuensinya di sini:
//   - koneksi pakai `pg` Pool, bukan file lokal
//   - "backup sebelum migrasi" pakai pg_dump ke folder lokal (bukan copy file .db)
//   - migration runner tetap pola yang sama (numbered files, tabel migrations,
//     backup-lalu-stop-kalau-gagal) supaya konsisten dengan referensi
import pg from 'pg'
import { spawnSync } from 'child_process'
import { join } from 'path'
import { mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { createRequire } from 'module'
import { homedir } from 'os'
import migrations from './migrations/index.js'

const { Pool } = pg

let pool = null

function userDataPath() {
    try {
        const require = createRequire(import.meta.url)
        const electron = require('electron')
        if (electron?.app?.getPath) return electron.app.getPath('userData')
    } catch {}
    return process.env.KHANZA_USER_DATA_DIR || join(homedir(), '.config', 'khanza-desktop')
}

function connect() {
    if (pool) return pool

    pool = new Pool({
        host:     process.env.PGHOST     || 'localhost',
        port:     Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE || 'khanza',
        user:     process.env.PGUSER     || 'khanza_app',
        password: process.env.PGPASSWORD || '',
        max: 10,
    })

    return pool
}

async function runMigrations() {
    const db = connect()

    await db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            name    TEXT PRIMARY KEY,
            ran_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `)

    const { rows } = await db.query('SELECT name FROM migrations')
    const ran     = rows.map(r => r.name)
    const pending = migrations.filter(m => !ran.includes(m.name))
    if (pending.length === 0) return

    // Backup sebelum migrasi jalan pada instalasi yang SUDAH punya data (bukan
    // fresh install). Gagal backup = HENTIKAN migrasi (jangan sampai migrasi
    // destruktif jalan tanpa jaring pengaman) — sama seperti prinsip di referensi.
    if (ran.length > 0) {
        const dest = backupBeforeMigrations()
        if (!dest) throw new Error('[migrasi] backup gagal — migrasi DIHENTIKAN demi keamanan data')
        console.log(`[migrasi] ${pending.length} migrasi tertunda — backup dibuat di ${dest}`)
    }

    for (const { name, up } of pending) {
        const client = await db.connect()
        try {
            await client.query('BEGIN')
            await up(client)
            await client.query('INSERT INTO migrations (name) VALUES ($1)', [name])
            await client.query('COMMIT')
        } catch (err) {
            await client.query('ROLLBACK')
            throw new Error(`[migrasi] gagal menjalankan ${name}: ${err.message}`)
        } finally {
            client.release()
        }
    }
}

// Backup pakai pg_dump (custom format) ke folder lokal komputer yang menjalankan
// migrasi. Beda dari referensi (copy file SQLite) karena Postgres adalah server
// terpusat — backup di sini sifatnya jaring pengaman TAMBAHAN untuk proses migrasi,
// BUKAN pengganti backup rutin DB oleh DBA/infra RS (itu tetap wajib ada terpisah).
function backupBeforeMigrations() {
    const dataPath   = userDataPath()
    const backupsDir = join(dataPath, 'backups')
    mkdirSync(backupsDir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest  = join(backupsDir, `khanza-pra-migrasi-${stamp}.dump`)

    const result = spawnSync('pg_dump', [
        '-h', process.env.PGHOST     || 'localhost',
        '-p', process.env.PGPORT     || '5432',
        '-U', process.env.PGUSER     || 'khanza_app',
        '-Fc', '-f', dest,
        process.env.PGDATABASE || 'khanza',
    ], {
        env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
    })

    if (result.status !== 0) {
        console.error('[migrasi] pg_dump gagal:', result.stderr?.toString())
        return null
    }

    pruneBackups(backupsDir, 3)
    return dest
}

function pruneBackups(dir, keep) {
    try {
        const files = readdirSync(dir)
            .filter(f => f.startsWith('khanza-pra-migrasi-') && f.endsWith('.dump'))
            .map(f => ({ f, t: statSync(join(dir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t)
        for (const { f } of files.slice(keep)) {
            try { unlinkSync(join(dir, f)) } catch {}
        }
    } catch {}
}

async function get() {
    if (!pool) connect()
    await runMigrations()
    return pool
}

async function close() {
    if (pool) {
        await pool.end()
        pool = null
    }
}

export default { connect, get, runMigrations, close }
