// SuratMasuk/SuratKeluar — src/surat/SuratMasuk.java & SuratKeluar.java
// SENDIRI tidak nyentuh DB (JavaFX WebView shell doang, lihat SOP Khanza.md).
// Logic aslinya ada di PHP: webapps/surat/pages/{input,input2,list,list2}.php.
// Ini modul PERTAMA yang di-porting dari pola hybrid webview ke native —
// jadi pilot buat strategi "Arsitektur Hybrid WebView" yang sudah diputuskan.
//
// TEMUAN PENTING (direplikasi sengaja): field "Nomor Masuk/Keluar" di form
// PHP asli KELIHATAN bisa diedit user (text input, required, ada pattern
// regex) — TAPI nilainya TIDAK PERNAH dibaca saat submit. PHP selalu
// RECOMPUTE no_urut dari tgl_terima/tgl_kirim yang dipilih user saat itu
// juga (SM/SK + tanggal + urutan harian). Jadi di sini pun `no_urut` dari
// form SELALU diabaikan, server yang hitung ulang — bukan kelalaian, itu
// perilaku asli (mungkin awalnya bug, tapi kita replikasi apa adanya).
//
// DEVIASI SENGAJA dari asli: filter List (status/ruang/balas) di PHP asli
// nge-LIKE match ke TEKS label hasil JOIN (rawan salah kalau ada label mirip)
// — di sini difilter langsung pakai KODE (kd_status/kd_ruang/kd_balas) yang
// dipilih dari dropdown, hasil akhirnya sama (user tetap pilih dari opsi
// yang sama), cuma query-nya lebih aman/tepat.
//
// File lampiran WAJIB (persis asli, divalidasi 3 lapis ekstensi/MIME di PHP)
// — disimpan ke MinIO (bukan folder lokal `pages/upload/`), DB cuma nyimpan
// OBJECT KEY-nya di kolom `file_url` (nama kolom dipertahankan sama dengan
// asli meski isinya sekarang object key, bukan path lokal). Tabel ASLI
// sik.sql `surat_masuk`/`surat_keluar` — field-nya cocok 1:1 dgn yang sudah
// dibangun, cuma dialect yang disesuaikan ke MySQL.
import DatabaseService from '../../DatabaseService.js'
import MinioService from '../../../electron/MinioService.js'

const CONFIG = {
    masuk: {
        table: 'surat_masuk', prefix: 'SM', tglField: 'tgl_terima',
        searchCols: ['no_surat', 'asal', 'tujuan', 'lampiran', 'tembusan', 'keterangan'],
        hasAsal: true,
    },
    keluar: {
        table: 'surat_keluar', prefix: 'SK', tglField: 'tgl_kirim',
        searchCols: ['no_surat', 'tujuan', 'lampiran', 'tembusan', 'keterangan'],
        hasAsal: false,
    },
}

function getConfig(jenis) {
    const cfg = CONFIG[jenis]
    if (!cfg) throw new Error(`Jenis surat tidak dikenal: ${jenis}`)
    return cfg
}

const SORTABLE = { no_urut: 't.no_urut', no_surat: 't.no_surat', tgl_surat: 't.tgl_surat' }

async function list(jenis, { page = 1, pageSize = 10, sortBy = 'no_urut', sortOrder = 'desc', search = '', kd_status = '', kd_ruang = '', kd_balas = '', tgl1 = '', tgl2 = '' } = {}) {
    const { table, tglField, searchCols } = getConfig(jenis)
    const db = await DatabaseService.get()
    const col = SORTABLE[sortBy] || `t.${tglField}`
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`

    const where = [`(? = '' OR (${searchCols.map(c => `t.${c} LIKE ?`).join(' OR ')}))`]
    const params = [search, ...searchCols.map(() => like)]
    if (kd_status) { where.push('t.kd_status = ?'); params.push(kd_status) }
    if (kd_ruang)  { where.push('t.kd_ruang = ?');  params.push(kd_ruang) }
    if (kd_balas)  { where.push('t.kd_balas = ?');  params.push(kd_balas) }
    if (tgl1 && tgl2) { where.push(`t.${tglField} BETWEEN ? AND ?`); params.push(tgl1, tgl2) }

    const { rows } = await db.query(
        `SELECT t.*, l.lemari, r.rak, m.map, ru.ruang, s.sifat, b.balas, st.status, k.klasifikasi
         FROM ${table} t
         JOIN surat_lemari l ON l.kd = t.kd_lemari
         JOIN surat_rak r ON r.kd = t.kd_rak
         JOIN surat_map m ON m.kd = t.kd_map
         JOIN surat_ruang ru ON ru.kd = t.kd_ruang
         JOIN surat_sifat s ON s.kd = t.kd_sifat
         JOIN surat_balas b ON b.kd = t.kd_balas
         JOIN surat_status st ON st.kd = t.kd_status
         JOIN surat_klasifikasi k ON k.kd = t.kd_klasifikasi
         WHERE ${where.join(' AND ')}
         ORDER BY ${col} ${dir}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM ${table} t WHERE ${where.join(' AND ')}`,
        params
    )
    return { data: rows, total: count }
}

// Replika persis MAX(RIGHT(no_urut,3))+1 per tanggal, prefix SM/SK.
async function nextNoUrut(jenis, tgl) {
    const { table, prefix, tglField } = getConfig(jenis)
    const db = await DatabaseService.get()
    const tanggal = tgl || new Date().toISOString().slice(0, 10)
    const { rows: [{ mx }] } = await db.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(RIGHT(no_urut, 3), '[^0-9]', ''), '') AS UNSIGNED)), 0) AS mx
         FROM ${table} WHERE ${tglField} = ?`,
        [tanggal]
    )
    // mysql2 balikin hasil CAST(...AS UNSIGNED) sebagai STRING, WAJIB Number()
    // dulu — lihat catatan panjang di TokoBarangService.nextKode() soal bug
    // nyata yang ketemu dari pola persis ini ("2"+1="21" bukan 3).
    return prefix + tanggal.replaceAll('-', '') + String(Number(mx) + 1).padStart(3, '0')
}

// Urutan validasi SAMA seperti chain !empty() di PHP asli.
function validate(jenis, data) {
    const { hasAsal } = getConfig(jenis)
    if (!data.no_surat?.trim()) return 'Nomor Surat tidak boleh kosong'
    if (hasAsal && !data.asal?.trim()) return 'Asal tidak boleh kosong'
    if (!data.tujuan?.trim()) return 'Tujuan tidak boleh kosong'
    if (!data.tgl_surat) return 'Tanggal Surat tidak boleh kosong'
    if (!data.perihal?.trim()) return 'Perihal tidak boleh kosong'
    if (!data.tgl_pokok) return hasAsal ? 'Tanggal Terima tidak boleh kosong' : 'Tanggal Kirim tidak boleh kosong'
    if (!data.kd_lemari?.trim()) return 'Almari Surat tidak boleh kosong'
    if (!data.kd_rak?.trim()) return 'Rak Surat tidak boleh kosong'
    if (!data.kd_map?.trim()) return 'Map Surat tidak boleh kosong'
    if (!data.kd_ruang?.trim()) return 'Ruang Surat tidak boleh kosong'
    if (!data.kd_sifat?.trim()) return 'Sifat Surat tidak boleh kosong'
    if (!data.lampiran?.trim()) return 'Lampiran tidak boleh kosong'
    if (!data.tembusan?.trim()) return 'Tembusan tidak boleh kosong'
    if (!data.tgl_deadline_balas) return 'Deadline Balas tidak boleh kosong'
    if (!data.kd_balas?.trim()) return 'Status Balas tidak boleh kosong'
    if (!data.keterangan?.trim()) return 'Keterangan tidak boleh kosong'
    if (!data.kd_status?.trim()) return 'Status Surat tidak boleh kosong'
    if (!data.kd_klasifikasi?.trim()) return 'Klasifikasi Surat tidak boleh kosong'
    if (!data.file_url?.trim()) return 'File Berkas (PDF/JPG) tidak boleh kosong'
    return null
}

async function create(jenis, data) {
    const err = validate(jenis, data)
    if (err) return { success: false, message: err }

    const { table, hasAsal, tglField } = getConfig(jenis)
    const db = await DatabaseService.get()
    // no_urut form diabaikan sengaja (lihat catatan header) — dihitung ulang
    // dari tanggal pokok (tgl_terima utk masuk / tgl_kirim utk keluar) yang
    // BENERAN dipilih user saat submit, bukan dari suggestion awal.
    const noUrut = await nextNoUrut(jenis, data.tgl_pokok)

    const kolom = ['no_urut', 'no_surat', ...(hasAsal ? ['asal'] : []), 'tujuan', 'tgl_surat', 'perihal', tglField,
        'kd_lemari', 'kd_rak', 'kd_map', 'kd_ruang', 'kd_sifat', 'lampiran', 'tembusan', 'tgl_deadline_balas',
        'kd_balas', 'keterangan', 'kd_status', 'kd_klasifikasi', 'file_url']
    const nilai = [noUrut, data.no_surat, ...(hasAsal ? [data.asal] : []), data.tujuan, data.tgl_surat, data.perihal,
        data.tgl_pokok, data.kd_lemari, data.kd_rak, data.kd_map, data.kd_ruang, data.kd_sifat, data.lampiran,
        data.tembusan, data.tgl_deadline_balas, data.kd_balas, data.keterangan, data.kd_status, data.kd_klasifikasi,
        data.file_url]
    const placeholders = nilai.map(() => '?').join(',')

    try {
        await db.query(`INSERT INTO ${table} (${kolom.join(',')}) VALUES (${placeholders})`, nilai)
        return { success: true, no_urut: noUrut }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: 'Nomor Surat sudah ada' }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Almari/Rak/Map/Ruang/Sifat/Balas/Status/Klasifikasi yang dipilih tidak valid' }
        }
        throw e
    }
}

// Replika urutan Java asli: hapus file MinIO dulu, baru row DB (kalau hapus
// file gagal — mis. sudah kehapus manual — tetap lanjut hapus row, sama
// seperti PHP asli yang unlink()-nya diam-diam gagal tanpa hentikan proses).
async function deleteOne(jenis, noUrut) {
    const { table } = getConfig(jenis)
    const db = await DatabaseService.get()
    const { rows: [row] } = await db.query(`SELECT file_url FROM ${table} WHERE no_urut=?`, [noUrut])
    if (!row) return { success: false, message: 'Data tidak ditemukan' }

    if (row.file_url) {
        await MinioService.remove(row.file_url).catch(() => {})
    }
    const { rows: result } = await db.query(`DELETE FROM ${table} WHERE no_urut=?`, [noUrut])
    return { success: result.affectedRows > 0, message: result.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

export default { list, nextNoUrut, create, deleteOne }
