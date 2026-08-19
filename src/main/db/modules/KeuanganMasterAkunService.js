import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

// --- KELOMPOK AKUN BAYAR KASIR ---
// akun_bayar.kd_rek UNIQUE (1 rekening cuma boleh 1 metode bayar) + direferensi
// FK dari banyak tabel transaksi (deposit, bayar_pemesanan, dst) — replika
// DlgAkunBayar.java.
async function listAkunBayar() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT a.nama_bayar, a.kd_rek, r.nm_rek, a.ppn
            FROM akun_bayar a
            LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
            ORDER BY a.nama_bayar ASC
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error listAkunBayar', { message: err.message, stack: err.stack })
        console.error('[KeuanganMasterAkunService] Error listAkunBayar:', err)
        throw err
    }
}

function friendlyDbError(err, { entityLabel, uniqueFieldLabel, inUseLabel }) {
    if (err.code === 'ER_DUP_ENTRY') {
        return uniqueFieldLabel
            ? `${uniqueFieldLabel} sudah dipakai di ${entityLabel} lain`
            : `${entityLabel} ini sudah terdaftar`
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
        return 'Rekening/referensi yang dipilih tidak ditemukan di Master COA'
    }
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        return inUseLabel || `${entityLabel} ini sudah dipakai di transaksi lain dan tidak bisa dihapus`
    }
    return err.message
}

async function createAkunBayar(data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (data.nama_bayar.trim().length > 50) return { success: false, message: 'Nama bayar maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_bayar (nama_bayar, kd_rek, ppn) VALUES (?, ?, ?)',
            [data.nama_bayar.trim(), data.kd_rek.trim(), Number(data.ppn || 0)]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error createAkunBayar', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error createAkunBayar:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun bayar', uniqueFieldLabel: 'Rekening/Nama bayar' }) }
    }
}

async function updateAkunBayar(oldNama, data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (data.nama_bayar.trim().length > 50) return { success: false, message: 'Nama bayar maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'UPDATE akun_bayar SET nama_bayar = ?, kd_rek = ?, ppn = ? WHERE nama_bayar = ?',
            [data.nama_bayar.trim(), data.kd_rek.trim(), Number(data.ppn || 0), oldNama]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error updateAkunBayar', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error updateAkunBayar:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun bayar', uniqueFieldLabel: 'Rekening/Nama bayar' }) }
    }
}

async function deleteAkunBayar(nama_bayar) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_bayar WHERE nama_bayar = ?', [nama_bayar])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error deleteAkunBayar', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error deleteAkunBayar:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun bayar', inUseLabel: 'Akun bayar ini sudah dipakai di transaksi kasir/deposit/hutang dan tidak bisa dihapus' }) }
    }
}

// --- KELOMPOK AKUN PIUTANG PASIEN ---
// akun_piutang UNIQUE (kd_rek, kd_pj) — kombinasi rekening+penjamin tidak
// boleh duplikat, tapi 1 rekening boleh dipakai penjamin berbeda — replika
// DlgAkunPiutang.java.
async function listAkunPiutang() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT a.nama_bayar, a.kd_rek, r.nm_rek, a.kd_pj, p.png_jawab
            FROM akun_piutang a
            LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
            LEFT JOIN penjab p ON a.kd_pj = p.kd_pj
            ORDER BY a.nama_bayar ASC
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error listAkunPiutang', { message: err.message, stack: err.stack })
        console.error('[KeuanganMasterAkunService] Error listAkunPiutang:', err)
        throw err
    }
}

async function createAkunPiutang(data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (!data.kd_pj?.trim()) return { success: false, message: 'Penjamin tidak boleh kosong' }
    if (data.nama_bayar.trim().length > 50) return { success: false, message: 'Nama bayar maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }
    if (data.kd_pj.trim().length > 3) return { success: false, message: 'Kode penjamin maksimal 3 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_piutang (nama_bayar, kd_rek, kd_pj) VALUES (?, ?, ?)',
            [data.nama_bayar.trim(), data.kd_rek.trim(), data.kd_pj.trim()]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error createAkunPiutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error createAkunPiutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun piutang', uniqueFieldLabel: 'Kombinasi rekening + penjamin ini' }) }
    }
}

async function updateAkunPiutang(oldNama, data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (!data.kd_pj?.trim()) return { success: false, message: 'Penjamin tidak boleh kosong' }
    if (data.nama_bayar.trim().length > 50) return { success: false, message: 'Nama bayar maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }
    if (data.kd_pj.trim().length > 3) return { success: false, message: 'Kode penjamin maksimal 3 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'UPDATE akun_piutang SET nama_bayar = ?, kd_rek = ?, kd_pj = ? WHERE nama_bayar = ?',
            [data.nama_bayar.trim(), data.kd_rek.trim(), data.kd_pj.trim(), oldNama]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error updateAkunPiutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error updateAkunPiutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun piutang', uniqueFieldLabel: 'Kombinasi rekening + penjamin ini' }) }
    }
}

async function deleteAkunPiutang(nama_bayar) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_piutang WHERE nama_bayar = ?', [nama_bayar])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error deleteAkunPiutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error deleteAkunPiutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun piutang', inUseLabel: 'Akun piutang ini sudah dipakai di transaksi piutang pasien dan tidak bisa dihapus' }) }
    }
}

// --- KELOMPOK AKUN PELUNASAN HUTANG VENDOR ---
// Direferensi FK dari 7 tabel bayar_pemesanan* — replika DlgAkunBayarHutang.java.
async function listAkunBayarHutang() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT a.nama_bayar, a.kd_rek, r.nm_rek
            FROM akun_bayar_hutang a
            LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
            ORDER BY a.nama_bayar ASC
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error listAkunBayarHutang', { message: err.message, stack: err.stack })
        console.error('[KeuanganMasterAkunService] Error listAkunBayarHutang:', err)
        throw err
    }
}

async function createAkunBayarHutang(data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (data.nama_bayar.trim().length > 50) return { success: false, message: 'Nama bayar maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_bayar_hutang (nama_bayar, kd_rek) VALUES (?, ?)',
            [data.nama_bayar.trim(), data.kd_rek.trim()]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error createAkunBayarHutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error createAkunBayarHutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun bayar hutang', uniqueFieldLabel: 'Nama bayar' }) }
    }
}

async function updateAkunBayarHutang(oldNama, data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (data.nama_bayar.trim().length > 50) return { success: false, message: 'Nama bayar maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'UPDATE akun_bayar_hutang SET nama_bayar = ?, kd_rek = ? WHERE nama_bayar = ?',
            [data.nama_bayar.trim(), data.kd_rek.trim(), oldNama]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error updateAkunBayarHutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error updateAkunBayarHutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun bayar hutang', uniqueFieldLabel: 'Nama bayar' }) }
    }
}

async function deleteAkunBayarHutang(nama_bayar) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_bayar_hutang WHERE nama_bayar = ?', [nama_bayar])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error deleteAkunBayarHutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error deleteAkunBayarHutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun bayar hutang', inUseLabel: 'Akun bayar hutang ini sudah dipakai di transaksi pelunasan hutang vendor dan tidak bisa dihapus' }) }
    }
}

// --- KELOMPOK AKUN ASET INVENTARIS ---
// Replika DlgAkunAsetInventaris.java. Tidak ada tabel lain yang FK ke sini
// (aman dihapus kapan saja), tapi tetap FK ke rekening & inventaris_jenis.
async function listAkunAset() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT a.id_jenis, j.nama_jenis, a.kd_rek, r.nm_rek
            FROM akun_aset_inventaris a
            LEFT JOIN inventaris_jenis j ON a.id_jenis = j.id_jenis
            LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
            ORDER BY a.id_jenis ASC
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error listAkunAset', { message: err.message, stack: err.stack })
        console.error('[KeuanganMasterAkunService] Error listAkunAset:', err)
        throw err
    }
}

async function createAkunAset(data) {
    if (!data.id_jenis?.trim()) return { success: false, message: 'Jenis inventaris tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (data.id_jenis.trim().length > 10) return { success: false, message: 'ID jenis maksimal 10 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_aset_inventaris (kd_rek, id_jenis) VALUES (?, ?)',
            [data.kd_rek.trim(), data.id_jenis.trim()]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error createAkunAset', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error createAkunAset:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun aset inventaris', uniqueFieldLabel: 'Jenis inventaris' }) }
    }
}

async function updateAkunAset(oldIdJenis, data) {
    if (!data.id_jenis?.trim()) return { success: false, message: 'Jenis inventaris tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (data.id_jenis.trim().length > 10) return { success: false, message: 'ID jenis maksimal 10 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'UPDATE akun_aset_inventaris SET kd_rek = ?, id_jenis = ? WHERE id_jenis = ?',
            [data.kd_rek.trim(), data.id_jenis.trim(), oldIdJenis]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error updateAkunAset', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error updateAkunAset:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun aset inventaris', uniqueFieldLabel: 'Jenis inventaris' }) }
    }
}

async function deleteAkunAset(id_jenis) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_aset_inventaris WHERE id_jenis = ?', [id_jenis])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error deleteAkunAset', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error deleteAkunAset:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun aset inventaris' }) }
    }
}

// --- KELOMPOK KATEGORI PEMASUKAN LAIN ---
// Replika DlgKategoriPemasukan.java. Direferensi FK oleh 1 tabel transaksi.
async function listKategoriPemasukan() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT k.kode_kategori, k.nama_kategori, k.kd_rek, r1.nm_rek, k.kd_rek2, r2.nm_rek AS nm_rek2
            FROM kategori_pemasukan_lain k
            LEFT JOIN rekening r1 ON k.kd_rek = r1.kd_rek
            LEFT JOIN rekening r2 ON k.kd_rek2 = r2.kd_rek
            ORDER BY k.kode_kategori ASC
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error listKategoriPemasukan', { message: err.message, stack: err.stack })
        console.error('[KeuanganMasterAkunService] Error listKategoriPemasukan:', err)
        throw err
    }
}

async function createKategoriPemasukan(data) {
    if (!data.kode_kategori?.trim()) return { success: false, message: 'Kode kategori tidak boleh kosong' }
    if (!data.nama_kategori?.trim()) return { success: false, message: 'Nama kategori tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Akun debet tidak boleh kosong' }
    if (!data.kd_rek2?.trim()) return { success: false, message: 'Akun kredit (kontra akun) tidak boleh kosong' }
    if (data.kode_kategori.trim().length > 5) return { success: false, message: 'Kode kategori maksimal 5 karakter' }
    if (data.nama_kategori.trim().length > 50) return { success: false, message: 'Nama kategori maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }
    if (data.kd_rek2.trim().length > 15) return { success: false, message: 'Kode rekening 2 maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO kategori_pemasukan_lain (kode_kategori, nama_kategori, kd_rek, kd_rek2) VALUES (?, ?, ?, ?)',
            [data.kode_kategori.trim(), data.nama_kategori.trim(), data.kd_rek.trim(), data.kd_rek2.trim()]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error createKategoriPemasukan', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error createKategoriPemasukan:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'kategori pemasukan', uniqueFieldLabel: 'Kode kategori' }) }
    }
}

async function updateKategoriPemasukan(oldKode, data) {
    if (!data.kode_kategori?.trim()) return { success: false, message: 'Kode kategori tidak boleh kosong' }
    if (!data.nama_kategori?.trim()) return { success: false, message: 'Nama kategori tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Akun debet tidak boleh kosong' }
    if (!data.kd_rek2?.trim()) return { success: false, message: 'Akun kredit (kontra akun) tidak boleh kosong' }
    if (data.kode_kategori.trim().length > 5) return { success: false, message: 'Kode kategori maksimal 5 karakter' }
    if (data.nama_kategori.trim().length > 50) return { success: false, message: 'Nama kategori maksimal 50 karakter' }
    if (data.kd_rek.trim().length > 15) return { success: false, message: 'Kode rekening maksimal 15 karakter' }
    if (data.kd_rek2.trim().length > 15) return { success: false, message: 'Kode rekening 2 maksimal 15 karakter' }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'UPDATE kategori_pemasukan_lain SET kode_kategori = ?, nama_kategori = ?, kd_rek = ?, kd_rek2 = ? WHERE kode_kategori = ?',
            [data.kode_kategori.trim(), data.nama_kategori.trim(), data.kd_rek.trim(), data.kd_rek2.trim(), oldKode]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error updateKategoriPemasukan', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error updateKategoriPemasukan:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'kategori pemasukan', uniqueFieldLabel: 'Kode kategori' }) }
    }
}

async function deleteKategoriPemasukan(kode_kategori) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM kategori_pemasukan_lain WHERE kode_kategori = ?', [kode_kategori])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error deleteKategoriPemasukan', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error deleteKategoriPemasukan:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'kategori pemasukan', inUseLabel: 'Kategori pemasukan ini sudah dipakai di transaksi dan tidak bisa dihapus' }) }
    }
}

// KELOMPOK KATEGORI PENGELUARAN HARIAN dipindah ke KeuanganKategoriPengeluaranService.js
// (halaman dedicated /keuangan/kategori-pengeluaran, prasyarat Tahap D Pengeluaran
// Harian) — dihapus dari sini 2026-08-19 supaya tidak ada 2 implementasi CRUD
// untuk tabel kategori_pengeluaran_harian yang sama.

// --- KELOMPOK AKUN PENAGIHAN PIUTANG ---
// Replika DlgAkunPenagihanPiutang.java — PENTING: Java mewajibkan SEMUA 4
// field (Nama Bank, Rekening, Atas Nama, No. Rekening), bukan cuma 2 pertama
// (gap ditemukan 2026-08-19 saat audit, atas_nama/no_rek sebelumnya opsional).
async function listAkunPenagihanPiutang() {
    try {
        const db = await DatabaseService.get()
        const res = await db.query(`
            SELECT a.kd_rek, a.nama_bank, a.atas_nama, a.no_rek, r.nm_rek
            FROM akun_penagihan_piutang a
            LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
            ORDER BY a.nama_bank ASC
        `)
        return res.rows
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error listAkunPenagihanPiutang', { message: err.message, stack: err.stack })
        console.error('[KeuanganMasterAkunService] Error listAkunPenagihanPiutang:', err)
        throw err
    }
}

function validateAkunPenagihanPiutang(data) {
    if (!data.kd_rek?.trim()) return 'Kode rekening tidak boleh kosong'
    if (!data.nama_bank?.trim()) return 'Nama bank tidak boleh kosong'
    if (!data.atas_nama?.trim()) return 'Atas nama tidak boleh kosong'
    if (!data.no_rek?.trim()) return 'No. Rekening tidak boleh kosong'
    if (data.kd_rek.trim().length > 15) return 'Kode rekening maksimal 15 karakter'
    if (data.nama_bank.trim().length > 70) return 'Nama bank maksimal 70 karakter'
    if (data.atas_nama.trim().length > 50) return 'Atas nama maksimal 50 karakter'
    if (data.no_rek.trim().length > 20) return 'No rekening maksimal 20 karakter'
    return null
}

async function createAkunPenagihanPiutang(data) {
    const err = validateAkunPenagihanPiutang(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_penagihan_piutang (kd_rek, nama_bank, atas_nama, no_rek) VALUES (?, ?, ?, ?)',
            [data.kd_rek.trim(), data.nama_bank.trim(), data.atas_nama.trim(), data.no_rek.trim()]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error createAkunPenagihanPiutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error createAkunPenagihanPiutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun penagihan piutang', uniqueFieldLabel: 'Rekening' }) }
    }
}

async function updateAkunPenagihanPiutang(oldKdRek, data) {
    const err = validateAkunPenagihanPiutang(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    try {
        await db.query(
            'UPDATE akun_penagihan_piutang SET kd_rek = ?, nama_bank = ?, atas_nama = ?, no_rek = ? WHERE kd_rek = ?',
            [data.kd_rek.trim(), data.nama_bank.trim(), data.atas_nama.trim(), data.no_rek.trim(), oldKdRek]
        )
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error updateAkunPenagihanPiutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error updateAkunPenagihanPiutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun penagihan piutang', uniqueFieldLabel: 'Rekening' }) }
    }
}

async function deleteAkunPenagihanPiutang(kd_rek) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_penagihan_piutang WHERE kd_rek = ?', [kd_rek])
        return { success: true }
    } catch (err) {
        LogService.error('[KeuanganMasterAkunService] Error deleteAkunPenagihanPiutang', { message: err.message, stack: err.stack, code: err.code })
        console.error('[KeuanganMasterAkunService] Error deleteAkunPenagihanPiutang:', err)
        return { success: false, message: friendlyDbError(err, { entityLabel: 'akun penagihan piutang' }) }
    }
}

export default {
    listAkunBayar, createAkunBayar, updateAkunBayar, deleteAkunBayar,
    listAkunPiutang, createAkunPiutang, updateAkunPiutang, deleteAkunPiutang,
    listAkunBayarHutang, createAkunBayarHutang, updateAkunBayarHutang, deleteAkunBayarHutang,
    listAkunAset, createAkunAset, updateAkunAset, deleteAkunAset,
    listKategoriPemasukan, createKategoriPemasukan, updateKategoriPemasukan, deleteKategoriPemasukan,
    listAkunPenagihanPiutang, createAkunPenagihanPiutang, updateAkunPenagihanPiutang, deleteAkunPenagihanPiutang
}
