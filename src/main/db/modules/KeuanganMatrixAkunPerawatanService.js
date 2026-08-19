import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

// Replika bagian "Matrix Akun Tindakan Ralan/Ranap" di DlgPengaturanRekening.java
// (TabRawat index 1 & 2, tabModeRalan/tabModeRanap) — override akun PER JENIS
// TINDAKAN, di atas mapping default di set_akun_ralan/set_akun_ranap (tab
// "Rawat Jalan"/"Rawat Inap" yang sudah ada di KeuanganPengaturanRekeningService.js).
//
// Java query rekening mapping per baris lewat query TERPISAH di dalam loop
// (N+1: 1 query utk jns_perawatan/jns_perawatan_inap + 1 query tambahan PER
// BARIS ke matrik_akun_jns_perawatan*, total 1285+2995 query ekstra di data
// nyata) — di sini diganti 1 query JOIN sekali jalan (technical improvement,
// bukan perubahan hasil data).
//
// Java simpan: BtnSimpanActionPerformed iterasi SEMUA baris grid yang sedang
// tampil, dan CUMA baris yang ke-13 kolom akunnya TERISI PENUH yang di-delete+
// insert ulang ke tabel matrix (baris kosong/parsial dilewati diam-diam, TIDAK
// dihapus juga kalau sebelumnya sudah ada override — quirk Swing, bukan
// perilaku bisnis yang jelas). Direplikasi sebagai aturan bisnis intinya:
// simpan HANYA kalau ke-13 field terisi (all-or-nothing per baris) — tapi
// mekanismenya per-baris via modal (bukan grid tersimpan sekaligus), dan
// delete+insert diganti UPSERT (`ON DUPLICATE KEY UPDATE`, atomik, hasil akhir
// identik). "Hapus Override" (kembali ke default set_akun_ralan/ranap) juga
// ditambahkan sebagai kapabilitas baru — di Java tidak ada jalan bersih utk
// menghapus 1 baris matrix (cuma bisa lewat query manual ke DB), UX gap yang
// diperbaiki maju (forward-fix), bukan pengurangan fitur.

const MATRIX_FIELDS = [
    ['pendapatan_tindakan', 'Pendapatan Tindakan'],
    ['beban_jasa_dokter', 'Beban Jasa Dokter'],
    ['utang_jasa_dokter', 'Utang Jasa Dokter'],
    ['beban_jasa_paramedis', 'Beban Jasa Paramedis'],
    ['utang_jasa_paramedis', 'Utang Jasa Paramedis'],
    ['beban_kso', 'Beban KSO'],
    ['utang_kso', 'Utang KSO'],
    ['hpp_persediaan', 'HPP Persediaan'],
    ['persediaan_bhp', 'Persediaan BHP'],
    ['beban_jasa_sarana', 'Beban Jasa Sarana'],
    ['utang_jasa_sarana', 'Utang Jasa Sarana'],
    ['beban_menejemen', 'Beban Jasa Manajemen'],
    ['utang_menejemen', 'Utang Jasa Manajemen'],
]

const CONFIG = {
    ralan: {
        matrixTable: 'matrik_akun_jns_perawatan',
        sourceFrom: `FROM jns_perawatan j
            INNER JOIN kategori_perawatan kp ON j.kd_kategori = kp.kd_kategori
            INNER JOIN penjab pj ON pj.kd_pj = j.kd_pj
            INNER JOIN poliklinik pol ON pol.kd_poli = j.kd_poli`,
        selectExtra: 'pj.png_jawab, pol.nm_poli AS unit, NULL AS kelas',
        searchCols: ['j.kd_jenis_prw', 'j.nm_perawatan'],
    },
    ranap: {
        matrixTable: 'matrik_akun_jns_perawatan_inap',
        sourceFrom: `FROM jns_perawatan_inap j
            INNER JOIN kategori_perawatan kp ON j.kd_kategori = kp.kd_kategori
            INNER JOIN penjab pj ON pj.kd_pj = j.kd_pj
            INNER JOIN bangsal b ON b.kd_bangsal = j.kd_bangsal`,
        selectExtra: 'pj.png_jawab, b.nm_bangsal AS unit, j.kelas',
        searchCols: ['j.kd_jenis_prw', 'j.nm_perawatan'],
    },
}

function getConfig(tipe) {
    const cfg = CONFIG[tipe]
    if (!cfg) throw new Error(`Tipe matrix tidak dikenal: ${tipe}`)
    return cfg
}

function matrixJoinSelect() {
    return MATRIX_FIELDS.map(([col], i) => `m.${col}, r${i}.nm_rek AS nm_${col}`).join(', ')
}

function matrixJoinClause() {
    return MATRIX_FIELDS.map(([col], i) => `LEFT JOIN rekening r${i} ON m.${col} = r${i}.kd_rek`).join('\n            ')
}

async function list(tipe, { search = '', onlyMapped = false } = {}) {
    try {
        const cfg = getConfig(tipe)
        const db = await DatabaseService.get()
        const args = []
        let where = `WHERE j.status = '1'`
        if (search.trim()) {
            where += ` AND (${cfg.searchCols.map(c => `${c} LIKE ?`).join(' OR ')})`
            cfg.searchCols.forEach(() => args.push(`%${search.trim()}%`))
        }
        if (onlyMapped) where += ' AND m.kd_jenis_prw IS NOT NULL'

        const res = await db.query(
            `SELECT j.kd_jenis_prw, j.nm_perawatan, kp.nm_kategori, ${cfg.selectExtra}, ${matrixJoinSelect()}
             ${cfg.sourceFrom}
             LEFT JOIN ${cfg.matrixTable} m ON m.kd_jenis_prw = j.kd_jenis_prw
             ${matrixJoinClause()}
             ${where}
             ORDER BY j.kd_jenis_prw`,
            args
        )
        return { rows: res.rows }
    } catch (err) {
        LogService.error('[KeuanganMatrixAkunPerawatanService] Error list', { message: err.message, stack: err.stack, tipe })
        console.error('[KeuanganMatrixAkunPerawatanService] Error list:', err)
        throw err
    }
}

async function save(tipe, kd_jenis_prw, fields) {
    const cfg = getConfig(tipe)
    if (!kd_jenis_prw) return { success: false, message: 'Kode jenis tindakan tidak valid' }
    const missing = MATRIX_FIELDS.filter(([col]) => !fields?.[col]?.trim())
    if (missing.length) {
        return { success: false, message: `Semua ${MATRIX_FIELDS.length} akun wajib diisi (belum lengkap: ${missing.map(([, label]) => label).join(', ')})` }
    }

    const db = await DatabaseService.get()
    const cols = MATRIX_FIELDS.map(([col]) => col)
    const values = cols.map(col => fields[col].trim())
    try {
        await db.query(
            `INSERT INTO ${cfg.matrixTable} (kd_jenis_prw, ${cols.join(', ')})
             VALUES (?, ${cols.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${cols.map(col => `${col} = VALUES(${col})`).join(', ')}`,
            [kd_jenis_prw, ...values]
        )
        return { success: true }
    } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Salah satu akun yang dipilih tidak ditemukan di Master COA' }
        }
        LogService.error('[KeuanganMatrixAkunPerawatanService] Error save', { message: err.message, stack: err.stack, code: err.code, tipe, kd_jenis_prw })
        console.error('[KeuanganMatrixAkunPerawatanService] Error save:', err)
        return { success: false, message: err.message }
    }
}

async function removeOverride(tipe, kd_jenis_prw) {
    const cfg = getConfig(tipe)
    const db = await DatabaseService.get()
    try {
        await db.query(`DELETE FROM ${cfg.matrixTable} WHERE kd_jenis_prw = ?`, [kd_jenis_prw])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMatrixAkunPerawatanService] Error removeOverride', { message: err.message, stack: err.stack, code: err.code, tipe, kd_jenis_prw })
        console.error('[KeuanganMatrixAkunPerawatanService] Error removeOverride:', err)
        return { success: false, message: err.message }
    }
}

export default { MATRIX_FIELDS, list, save, removeOverride }
