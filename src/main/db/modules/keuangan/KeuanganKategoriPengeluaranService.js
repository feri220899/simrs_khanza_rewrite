import DatabaseService from '../../DatabaseService.js'
import LogService from '../../../electron/LogService.js'

// Replika DlgKategoriPengeluaran.java: master kategori pengeluaran harian.
// kd_rek = akun beban (didebet saat transaksi), kd_rek2 = akun kas/bank
// kontra (dikredit saat transaksi) — lihat DlgPengeluaranHarian.java
// BtnSimpanActionPerformed baris 775-786.

async function list() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT k.kode_kategori, k.nama_kategori, k.kd_rek, r1.nm_rek AS nm_rek_akun, k.kd_rek2, r2.nm_rek AS nm_rek_kontra
            FROM kategori_pengeluaran_harian k
            LEFT JOIN rekening r1 ON k.kd_rek = r1.kd_rek
            LEFT JOIN rekening r2 ON k.kd_rek2 = r2.kd_rek
            ORDER BY k.kode_kategori
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganKategoriPengeluaranService] Error list', { message: err.message, stack: err.stack })
        console.error('[KeuanganKategoriPengeluaranService] Error list:', err)
        throw err
    }
}

function validate(data) {
    if (!data.kode_kategori?.trim()) return 'Kode Kategori tidak boleh kosong'
    if (!data.nama_kategori?.trim()) return 'Nama Kategori tidak boleh kosong'
    if (!data.kd_rek?.trim()) return 'Akun Rekening tidak boleh kosong'
    if (!data.kd_rek2?.trim()) return 'Kontra Akun Rekening tidak boleh kosong'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO kategori_pengeluaran_harian (kode_kategori, nama_kategori, kd_rek, kd_rek2) VALUES (?, ?, ?, ?)',
            [data.kode_kategori.trim(), data.nama_kategori.trim(), data.kd_rek, data.kd_rek2]
        )
        return { success: true }
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode Kategori "${data.kode_kategori}" sudah dipakai` }
        if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Akun/kontra akun rekening tidak ditemukan di Master COA' }
        }
        LogService.error('[KeuanganKategoriPengeluaranService] Error create', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganKategoriPengeluaranService] Error create:', err)
        return { success: false, message: err.message }
    }
}

async function update(kodeKategori, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        const res = await db.query(
            'UPDATE kategori_pengeluaran_harian SET kode_kategori = ?, nama_kategori = ?, kd_rek = ?, kd_rek2 = ? WHERE kode_kategori = ?',
            [data.kode_kategori.trim(), data.nama_kategori.trim(), data.kd_rek, data.kd_rek2, kodeKategori]
        )
        if (res.rows.affectedRows === 0) return { success: false, message: 'Kategori tidak ditemukan' }
        return { success: true }
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return { success: false, message: `Kode Kategori "${data.kode_kategori}" sudah dipakai` }
        if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
            return { success: false, message: 'Akun/kontra akun rekening tidak ditemukan di Master COA' }
        }
        LogService.error('[KeuanganKategoriPengeluaranService] Error update', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganKategoriPengeluaranService] Error update:', err)
        return { success: false, message: err.message }
    }
}

async function deleteOne(kodeKategori) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM kategori_pengeluaran_harian WHERE kode_kategori = ?', [kodeKategori])
        return { success: true }
    } catch (err) {
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
            return { success: false, message: 'Kategori tidak bisa dihapus karena sudah dipakai di transaksi Pengeluaran Harian' }
        }
        LogService.error('[KeuanganKategoriPengeluaranService] Error deleteOne', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganKategoriPengeluaranService] Error deleteOne:', err)
        return { success: false, message: err.message }
    }
}

export default { list, create, update, deleteOne }
