// Pencatatan/pembayaran denda — src/perpustakaan/PerpustakaanBayarDenda.java.
// Dialog asli 1 layar 2-tab (Denda Keterlambatan / Denda Lain-lain), 2 tabel
// DB TERPISAH (`perpustakaan_bayar_denda_harian` & `perpustakaan_bayar_denda`
// — dikonfirmasi ULANG ada di sik.sql, bukan asumsi/sisa migration Postgres),
// 2 alur hitung berbeda — direplikasi sebagai 2 set fungsi di sini
// (harian/lain), BUKAN digabung jadi satu.
//
// CATATAN (beda kecil dari Java asli): `denda_perhari`/harga buku dibaca
// LIVE saat simpan (bukan dibaca sekali saat dialog dibuka lalu di-cache
// sepanjang sesi seperti Java asli) — perbaikan kecil, bukan perubahan yang
// terlihat user.
// GAP YANG DIREPLIKASI SENGAJA: tidak ada validasi silang ke
// perpustakaan_peminjaman (user bisa input kombinasi anggota/buku apa pun,
// jumlah hari telat manual, tidak otomatis sinkron dgn preview di Sirkulasi)
// — ini gap asli, bukan kelalaian di sini.
//
// `perpustakaan_set_peminjaman` TANPA kolom `id` (lihat catatan di
// PerpustakaanSirkulasiService.js) — query LIMIT 1 tanpa WHERE.
import DatabaseService from '../DatabaseService.js'

// ── Tab 0: Denda Keterlambatan ──────────────────────────────────────────────

async function listHarian({ page = 1, pageSize = 10, sortOrder = 'desc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT d.tgl_denda, d.no_anggota, a.nama_anggota, d.no_inventaris, b.judul_buku, d.keterlambatan, d.besar_denda
         FROM perpustakaan_bayar_denda_harian d
         JOIN perpustakaan_anggota a    ON a.no_anggota    = d.no_anggota
         JOIN perpustakaan_inventaris i ON i.no_inventaris = d.no_inventaris
         JOIN perpustakaan_buku b       ON b.kode_buku     = i.kode_buku
         WHERE a.nama_anggota LIKE ? OR b.judul_buku LIKE ?
         ORDER BY d.tgl_denda ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM perpustakaan_bayar_denda_harian d
         JOIN perpustakaan_anggota a    ON a.no_anggota    = d.no_anggota
         JOIN perpustakaan_inventaris i ON i.no_inventaris = d.no_inventaris
         JOIN perpustakaan_buku b       ON b.kode_buku     = i.kode_buku
         WHERE a.nama_anggota LIKE ? OR b.judul_buku LIKE ?`,
        [like, like]
    )
    return { data: rows, total: count }
}

async function createHarian({ tgl_denda, no_anggota, no_inventaris, keterlambatan }) {
    if (!no_inventaris?.trim()) return { success: false, message: 'Inventaris tidak boleh kosong' }
    if (!no_anggota?.trim()) return { success: false, message: 'Peminjam tidak boleh kosong' }
    if (!keterlambatan || Number(keterlambatan) <= 0) return { success: false, message: 'Keterlambatan tidak boleh kosong' }

    const db = await DatabaseService.get()
    const { rows: [setting] } = await db.query('SELECT denda_perhari FROM perpustakaan_set_peminjaman LIMIT 1')
    const besarDenda = Number(keterlambatan) * Number(setting?.denda_perhari || 0)
    if (besarDenda <= 0) return { success: false, message: 'Denda Keterlambatan tidak boleh kosong (cek Pengaturan Peminjaman)' }

    try {
        await db.query(
            `INSERT INTO perpustakaan_bayar_denda_harian (tgl_denda, no_anggota, no_inventaris, keterlambatan, besar_denda)
             VALUES (?, ?, ?, ?, ?)`,
            [tgl_denda, no_anggota, no_inventaris, keterlambatan, besarDenda]
        )
        return { success: true, besarDenda }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: 'Sudah ada catatan denda untuk kombinasi anggota/buku/tanggal ini' }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Anggota/Inventaris tidak valid' }
        }
        throw e
    }
}

async function deleteHarian({ tgl_denda, no_anggota, no_inventaris }) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        'DELETE FROM perpustakaan_bayar_denda_harian WHERE tgl_denda=? AND no_anggota=? AND no_inventaris=?',
        [tgl_denda, no_anggota, no_inventaris]
    )
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

// ── Tab 1: Denda Lain-lain ───────────────────────────────────────────────────

async function listLain({ page = 1, pageSize = 10, sortOrder = 'desc', search = '' } = {}) {
    const db = await DatabaseService.get()
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const like = `%${search}%`

    const { rows } = await db.query(
        `SELECT d.tgl_denda, d.no_anggota, a.nama_anggota, d.no_inventaris, b.judul_buku,
                d.kode_denda, jd.jenis_denda, d.besar_denda, d.keterangan_denda
         FROM perpustakaan_bayar_denda d
         JOIN perpustakaan_anggota a    ON a.no_anggota    = d.no_anggota
         JOIN perpustakaan_inventaris i ON i.no_inventaris = d.no_inventaris
         JOIN perpustakaan_buku b       ON b.kode_buku     = i.kode_buku
         JOIN perpustakaan_denda jd     ON jd.kode_denda   = d.kode_denda
         WHERE a.nama_anggota LIKE ? OR b.judul_buku LIKE ?
         ORDER BY d.tgl_denda ${dir}
         LIMIT ? OFFSET ?`,
        [like, like, pageSize, (page - 1) * pageSize]
    )
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) AS count FROM perpustakaan_bayar_denda d
         JOIN perpustakaan_anggota a    ON a.no_anggota    = d.no_anggota
         JOIN perpustakaan_inventaris i ON i.no_inventaris = d.no_inventaris
         JOIN perpustakaan_buku b       ON b.kode_buku     = i.kode_buku
         WHERE a.nama_anggota LIKE ? OR b.judul_buku LIKE ?`,
        [like, like]
    )
    return { data: rows, total: count }
}

async function createLain({ tgl_denda, no_anggota, no_inventaris, kode_denda, keterangan_denda }) {
    if (!no_inventaris?.trim()) return { success: false, message: 'Inventaris tidak boleh kosong' }
    if (!no_anggota?.trim()) return { success: false, message: 'Peminjam tidak boleh kosong' }
    if (!kode_denda?.trim()) return { success: false, message: 'Jenis Denda tidak boleh kosong' }
    if (!keterangan_denda?.trim()) return { success: false, message: 'Keterangan tidak boleh kosong' }

    const db = await DatabaseService.get()
    const { rows: [inv] } = await db.query(
        `SELECT i.harga FROM perpustakaan_inventaris i WHERE i.no_inventaris=?`, [no_inventaris]
    )
    const { rows: [jenis] } = await db.query('SELECT besar_denda FROM perpustakaan_denda WHERE kode_denda=?', [kode_denda])
    if (!inv || !jenis) return { success: false, message: 'Inventaris/Jenis Denda tidak valid' }

    const besarDenda = Number(inv.harga) * (Number(jenis.besar_denda) / 100)
    if (!besarDenda || besarDenda <= 0) return { success: false, message: 'Besar Denda tidak boleh kosong' }

    try {
        await db.query(
            `INSERT INTO perpustakaan_bayar_denda (tgl_denda, no_anggota, no_inventaris, kode_denda, besar_denda, keterangan_denda)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [tgl_denda, no_anggota, no_inventaris, kode_denda, besarDenda, keterangan_denda]
        )
        return { success: true, besarDenda }
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return { success: false, message: 'Sudah ada catatan denda untuk kombinasi ini' }
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Anggota/Inventaris/Jenis Denda tidak valid' }
        }
        throw e
    }
}

async function deleteLain({ tgl_denda, no_anggota, no_inventaris, kode_denda }) {
    const db = await DatabaseService.get()
    const { rows } = await db.query(
        'DELETE FROM perpustakaan_bayar_denda WHERE tgl_denda=? AND no_anggota=? AND no_inventaris=? AND kode_denda=?',
        [tgl_denda, no_anggota, no_inventaris, kode_denda]
    )
    return { success: rows.affectedRows > 0, message: rows.affectedRows === 0 ? 'Data tidak ditemukan' : undefined }
}

export default { listHarian, createHarian, deleteHarian, listLain, createLain, deleteLain }
