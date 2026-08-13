// "Pembanding Skema" — upload sik.sql versi baru dari vendor Khanza,
// dibandingkan ke skema MySQL yang sedang berjalan (`information_schema`,
// BUKAN tabel snapshot manual — selalu akurat, lihat diskusi di
// README.md/Khanza.md soal keputusan ini), supaya ketahuan tabel/kolom baru
// tanpa harus baca ulang 28MB+ dump manual tiap ada update dari vendor.
//
// Prinsip keamanan: TIDAK PERNAH auto-apply. Semua hasil diff cuma DRAFT —
// admin klik satu-satu utk terapkan. TIDAK ADA backup otomatis dari app ini
// (keputusan sengaja user — backup database `sik` sudah rutin di sisi
// server/DBA, bukan tanggung jawab app ini, dan `mysqldump` tidak selalu
// tersedia di tiap komputer klien) — UI (SchemaComparePanel.vue) WAJIB tetap
// tegaskan lewat konfirmasi eksplisit bahwa backup manual harus sudah
// dilakukan sebelum klik Terapkan. Kolom yang TIPE-nya berubah atau
// tabel/kolom yang HILANG di file baru TIDAK PERNAH ditawarkan tombol
// "Terapkan" sama sekali — itu berisiko data loss, cuma ditampilkan sebagai
// info buat direview manual oleh DBA.
import { dialog } from 'electron'
import { readFileSync } from 'fs'
import DatabaseService from '../DatabaseService.js'
import { EXTRA_SLUGS } from '../migrations/006_seed_electron_permissions_extra.js'
import { EXTRA_SLUGS_PENGATURAN_TABS } from '../migrations/007_seed_electron_permissions_pengaturan_tabs.js'

const ALL_EXTRA_SLUGS = [...EXTRA_SLUGS, ...EXTRA_SLUGS_PENGATURAN_TABS]

// Tabel `electron_*` itu punya kita, bukan bagian sik.sql asli — vendor
// TIDAK PERNAH tahu soal ini, jadi harus dikecualikan dari sisi "skema
// hidup" saat dibandingkan, supaya tidak selalu muncul palsu sebagai
// "5 tabel terhapus" tiap kali dibandingkan ke dump asli.
function isElectronTable(name) {
    return name.startsWith('electron_')
}

// Parser regex sederhana (bukan full SQL parser) — cukup buat format
// mysqldump standar yang dipakai sik.sql: tiap CREATE TABLE diakhiri baris
// `) ENGINE=...;`. Pola sama seperti scanner FK yang dipakai waktu perbaiki
// sik.sql sebelumnya (lihat riwayat percakapan), sekarang di JS bukan Python
// karena jalan di main process Electron.
function parseCreateTables(sqlText) {
    const tables = {} // { tableName: { columns: {col: type}, rawSql: '...' } }
    const re = /CREATE TABLE `(\w+)` \(\n([\s\S]*?)\n\) ENGINE=[^;]*;/g
    let m
    while ((m = re.exec(sqlText))) {
        const [rawSql, tableName, body] = m
        const columns = {}
        for (const rawLine of body.split('\n')) {
            const line = rawLine.trim().replace(/,$/, '')
            // Lewati baris PRIMARY KEY/KEY/UNIQUE KEY/CONSTRAINT/dst — cuma
            // ambil baris definisi kolom asli (diawali `nama_kolom`).
            const colMatch = line.match(/^`(\w+)`\s+(.+)$/)
            if (!colMatch) continue
            const [, colName, colType] = colMatch
            columns[colName] = colType
        }
        tables[tableName] = { columns, rawSql }
    }
    return tables
}

async function getLiveSchema() {
    const db = await DatabaseService.get()
    const { rows } = await db.query(`
        SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
    `)
    const tables = {}
    for (const r of rows) {
        tables[r.TABLE_NAME] ??= {}
        tables[r.TABLE_NAME][r.COLUMN_NAME] = r.COLUMN_TYPE
    }
    return tables
}

// `information_schema.COLUMN_TYPE` sudah bare (mis. "varchar(20)", tanpa
// NOT NULL/DEFAULT/AUTO_INCREMENT — itu kolom terpisah: IS_NULLABLE,
// COLUMN_DEFAULT, EXTRA). Definisi dari dump mentah (`type` hasil parse)
// MASIH ada embel-embel itu, jadi WAJIB dilucuti dulu sebelum dibandingkan,
// kalau tidak, SEMUA kolom akan salah terdeteksi "berubah tipe".
//
// KHUSUS tipe integer (int/tinyint/smallint/mediumint/bigint) & year: MySQL
// 8.0.19+ SUDAH TIDAK melaporkan display width lewat information_schema
// (`int(11)`/`year(4)` di dump lama balik jadi cuma `int`/`year`) walau
// kolomnya beneran dibuat dengan width itu — width-nya sendiri sudah
// deprecated/tidak berefek apa-apa sejak versi itu. Tanpa normalisasi ini,
// SEMUA kolom integer/year di sik.sql (ratusan) bakal salah terdeteksi
// "berubah tipe" padahal sama persis — sudah diverifikasi lewat perbandingan
// sik.sql asli vs database live (702 false positive sebelum fix ini).
//
// DEFAULT string literal dilucuti pakai aturan escaping MySQL yang benar
// (`''` di dalam string = 1 literal quote, BUKAN backslash) — dump asli
// punya kolom dgn `DEFAULT ''''''` (default value isinya 2 kutip literal),
// regex naive bakal berhenti di kutip pertama & nyisain sampah di hasil
// normalize (ketahuan pas tes ke `penilaian_fisioterapi.keluhan_utama`).
function normalizeType(raw) {
    return raw
        .replace(/\s+(NOT NULL|NULL|DEFAULT\s+(?:'(?:[^']|'')*'|\S+)|AUTO_INCREMENT|CHARACTER SET \S+|COLLATE \S+)/gi, '')
        .replace(/\b(tinyint|smallint|mediumint|bigint|int|year)\(\d+\)/gi, '$1')
        .trim()
        .toLowerCase()
}

function diffSchema(fileTables, liveTables) {
    const newTables = []
    const newColumns = []
    const changedColumns = []
    const removedTables = []
    const removedColumns = []

    for (const [table, { columns, rawSql }] of Object.entries(fileTables)) {
        if (!liveTables[table]) {
            newTables.push({ table, jmlKolom: Object.keys(columns).length, rawSql })
            continue
        }
        for (const [col, type] of Object.entries(columns)) {
            if (!(col in liveTables[table])) {
                newColumns.push({ table, column: col, type })
            } else if (liveTables[table][col].toLowerCase() !== normalizeType(type)) {
                changedColumns.push({ table, column: col, live: liveTables[table][col], file: normalizeType(type) })
            }
        }
    }
    for (const table of Object.keys(liveTables)) {
        if (isElectronTable(table)) continue
        if (!fileTables[table]) { removedTables.push(table); continue }
        for (const col of Object.keys(liveTables[table])) {
            if (!(col in fileTables[table].columns)) removedColumns.push({ table, column: col })
        }
    }

    return { newTables, newColumns, changedColumns, removedTables, removedColumns }
}

// Cek cakupan permission — BEDA dari diffSchema() di atas (yang bandingkan
// SKEMA kolom file vs live). Ini bandingkan kolom tabel `user` yang LIVE
// terhadap isi `electron_permissions`, apa pun sebab bedanya: kolom baru dari
// vendor (belum sempat di-apply lewat Kolom Baru), ATAU baris slug-nya
// kehapus manual/sengaja di electron_permissions padahal kolomnya masih ada.
// Makanya ini query independen (tidak butuh fileTables sama sekali) — cukup
// bandingkan dua tabel di database yang sama.
async function getMissingPermissions() {
    const db = await DatabaseService.get()
    const { rows: cols } = await db.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME NOT IN ('id_user', 'password')
    `)
    const { rows: perms } = await db.query('SELECT slug FROM electron_permissions')
    const existingSlugs = new Set(perms.map(p => p.slug))
    return cols.map(c => c.COLUMN_NAME).filter(col => !existingSlugs.has(col))
}

// Arah sebaliknya dari getMissingPermissions(): slug yang ADA di
// electron_permissions tapi kolom `user`-nya SUDAH TIDAK ADA — misal vendor
// mengganti nama/menghapus kolom di versi baru sik.sql, atau ada slug typo
// yang ke-insert manual. ALL_EXTRA_SLUGS ('dashboard'/'pengaturan-user'/
// 'pengaturan-database'/dst) SENGAJA dikecualikan — itu bukan kolom `user`
// sik.sql, memang tidak akan pernah punya pasangan kolom, jangan dilaporkan
// sebagai orphan.
async function getOrphanPermissions() {
    const db = await DatabaseService.get()
    const { rows: cols } = await db.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME NOT IN ('id_user', 'password')
    `)
    const existingCols = new Set(cols.map(c => c.COLUMN_NAME))
    const { rows: perms } = await db.query('SELECT slug, label FROM electron_permissions')
    return perms
        .filter(p => !existingCols.has(p.slug) && !ALL_EXTRA_SLUGS.includes(p.slug))
        .map(p => p.slug)
}

// Satu round-trip IPC buat dua arah sinkronisasi sekaligus — dipakai UI
// "Sinkronisasi Permission" (independen dari upload file).
async function checkPermissionSync() {
    const [missing, orphan] = await Promise.all([getMissingPermissions(), getOrphanPermissions()])
    return { missing, orphan }
}

// Buka dialog pilih file .sql lokal, parse, lalu bandingkan ke skema hidup.
// Dijalankan sepenuhnya di main process (dialog native + baca file) —
// renderer cuma terima hasil diff-nya, bukan isi file 28MB+ itu sendiri.
async function pickAndCompareFile() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Pilih file sik.sql terbaru',
        filters: [{ name: 'SQL', extensions: ['sql'] }],
        properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { canceled: true }

    const sqlText = readFileSync(filePaths[0], 'utf8')
    const fileTables = parseCreateTables(sqlText)
    if (Object.keys(fileTables).length === 0) {
        return { canceled: false, error: 'Tidak ketemu CREATE TABLE valid di file ini — pastikan ini dump mysqldump standar.' }
    }
    const liveTables = await getLiveSchema()
    const diff = diffSchema(fileTables, liveTables)

    // rawSql tabel baru disimpan di memori main process (bukan dikirim balik
    // full ke renderer per tabel dulu) supaya draft SQL tetap bisa ditampilkan
    // TAPI apply-nya nanti manggil ulang dari cache ini, bukan renderer kirim
    // balik SQL mentah (hindari renderer bisa suntik SQL sembarang lewat IPC).
    lastFileTables = fileTables
    return {
        canceled: false,
        fileName: filePaths[0].split('/').pop(),
        diff: {
            newTables: diff.newTables.map(({ table, jmlKolom }) => ({ table, jmlKolom })),
            newColumns: diff.newColumns,
            changedColumns: diff.changedColumns,
            removedTables: diff.removedTables,
            removedColumns: diff.removedColumns,
        },
    }
}

// Cache in-memory hasil parse terakhir — dipakai applyNewTable() supaya SQL
// yang dieksekusi PERSIS yang baru saja ditampilkan ke admin (bukan re-parse
// ulang file yang mungkin sudah diganti/dihapus di disk).
let lastFileTables = null

async function applyNewTable(tableName) {
    const def = lastFileTables?.[tableName]
    if (!def) return { success: false, message: 'Tabel tidak ditemukan di hasil pembanding terakhir — upload ulang file-nya.' }

    const db = await DatabaseService.get()
    await db.query(def.rawSql)
    return { success: true }
}

async function applyNewColumn(table, column, type) {
    const db = await DatabaseService.get()
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`)

    // Kolom baru di tabel `user` = fitur akses baru dari vendor — otomatis
    // usulkan jadi permission slug baru (belum di-assign role manapun,
    // Admin Utama yang putuskan lewat tab Role).
    if (table === 'user') {
        const label = column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        await db.query('INSERT IGNORE INTO electron_permissions (slug, label) VALUES (?, ?)', [column, label])
        return { success: true, permissionAdded: column }
    }
    return { success: true }
}

// Tambah 1 slug permission langsung (tanpa ALTER TABLE — kolomnya sudah ada
// di tabel `user`, cuma bookkeeping electron_permissions yang ketinggalan/
// terhapus). Dipakai tombol "Tambahkan" di bagian "Kolom user Tanpa
// Permission" — kebalikan dari cabang table==='user' di applyNewColumn()
// yang jalan waktu kolomnya BENERAN baru.
async function applyPermission(slug) {
    const db = await DatabaseService.get()
    const label = slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    await db.query('INSERT IGNORE INTO electron_permissions (slug, label) VALUES (?, ?)', [slug, label])
    return { success: true }
}

// Hapus slug yang orphan (kolom `user`-nya sudah tidak ada) — cascade ke
// electron_role_permissions lewat FK ON DELETE CASCADE (lihat
// 003_create_electron_role_permissions.js), jadi role yang kebetulan sudah
// dapat permission ini otomatis ikut kehilangan (masuk akal — fiturnya
// memang sudah tidak ada di kolom `user`).
async function removeOrphanPermission(slug) {
    const db = await DatabaseService.get()
    await db.query('DELETE FROM electron_permissions WHERE slug = ?', [slug])
    return { success: true }
}

export default {
    pickAndCompareFile, applyNewTable, applyNewColumn,
    applyPermission, removeOrphanPermission, checkPermissionSync,
}
