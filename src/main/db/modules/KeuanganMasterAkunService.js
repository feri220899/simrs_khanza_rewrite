import DatabaseService from '../DatabaseService.js'

// --- KELOMPOK AKUN BAYAR KASIR ---
async function listAkunBayar() {
    const db = await DatabaseService.get()
    const res = await db.query(`
        SELECT a.nama_bayar, a.kd_rek, r.nm_rek, a.ppn
        FROM akun_bayar a
        LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
        ORDER BY a.nama_bayar ASC
    `)
    return res.rows
}

async function createAkunBayar(data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    
    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_bayar (nama_bayar, kd_rek, ppn) VALUES (?, ?, ?)',
            [data.nama_bayar.trim(), data.kd_rek.trim(), Number(data.ppn || 0)]
        )
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

async function deleteAkunBayar(nama_bayar) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_bayar WHERE nama_bayar = ?', [nama_bayar])
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

// --- KELOMPOK AKUN PIUTANG PASIEN ---
async function listAkunPiutang() {
    const db = await DatabaseService.get()
    const res = await db.query(`
        SELECT a.nama_bayar, a.kd_rek, r.nm_rek, a.kd_pj, p.png_jawab
        FROM akun_piutang a
        LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
        LEFT JOIN penjab p ON a.kd_pj = p.kd_pj
        ORDER BY a.nama_bayar ASC
    `)
    return res.rows
}

async function createAkunPiutang(data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    if (!data.kd_pj?.trim()) return { success: false, message: 'Penjamin tidak boleh kosong' }
    
    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_piutang (nama_bayar, kd_rek, kd_pj) VALUES (?, ?, ?)',
            [data.nama_bayar.trim(), data.kd_rek.trim(), data.kd_pj.trim()]
        )
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

async function deleteAkunPiutang(nama_bayar) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_piutang WHERE nama_bayar = ?', [nama_bayar])
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

// --- KELOMPOK AKUN PELUNASAN HUTANG VENDOR ---
async function listAkunBayarHutang() {
    const db = await DatabaseService.get()
    const res = await db.query(`
        SELECT a.nama_bayar, a.kd_rek, r.nm_rek
        FROM akun_bayar_hutang a
        LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
        ORDER BY a.nama_bayar ASC
    `)
    return res.rows
}

async function createAkunBayarHutang(data) {
    if (!data.nama_bayar?.trim()) return { success: false, message: 'Nama bayar tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    
    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_bayar_hutang (nama_bayar, kd_rek) VALUES (?, ?)',
            [data.nama_bayar.trim(), data.kd_rek.trim()]
        )
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

async function deleteAkunBayarHutang(nama_bayar) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_bayar_hutang WHERE nama_bayar = ?', [nama_bayar])
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

// --- KELOMPOK AKUN ASET INVENTARIS ---
async function listAkunAset() {
    const db = await DatabaseService.get()
    const res = await db.query(`
        SELECT a.id_jenis, j.nama_jenis, a.kd_rek, r.nm_rek
        FROM akun_aset_inventaris a
        LEFT JOIN inventaris_jenis j ON a.id_jenis = j.id_jenis
        LEFT JOIN rekening r ON a.kd_rek = r.kd_rek
        ORDER BY a.id_jenis ASC
    `)
    return res.rows
}

async function createAkunAset(data) {
    if (!data.id_jenis?.trim()) return { success: false, message: 'Jenis inventaris tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Kode rekening tidak boleh kosong' }
    
    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO akun_aset_inventaris (kd_rek, id_jenis) VALUES (?, ?)',
            [data.kd_rek.trim(), data.id_jenis.trim()]
        )
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

async function deleteAkunAset(id_jenis) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM akun_aset_inventaris WHERE id_jenis = ?', [id_jenis])
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

// --- KELOMPOK KATEGORI PEMASUKAN LAIN ---
async function listKategoriPemasukan() {
    const db = await DatabaseService.get()
    const res = await db.query(`
        SELECT k.kode_kategori, k.nama_kategori, k.kd_rek, r1.nm_rek, k.kd_rek2, r2.nm_rek AS nm_rek2
        FROM kategori_pemasukan_lain k
        LEFT JOIN rekening r1 ON k.kd_rek = r1.kd_rek
        LEFT JOIN rekening r2 ON k.kd_rek2 = r2.kd_rek
        ORDER BY k.kode_kategori ASC
    `)
    return res.rows
}

async function createKategoriPemasukan(data) {
    if (!data.kode_kategori?.trim()) return { success: false, message: 'Kode kategori tidak boleh kosong' }
    if (!data.nama_kategori?.trim()) return { success: false, message: 'Nama kategori tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Akun debet tidak boleh kosong' }
    if (!data.kd_rek2?.trim()) return { success: false, message: 'Akun kredit (kontra akun) tidak boleh kosong' }
    
    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO kategori_pemasukan_lain (kode_kategori, nama_kategori, kd_rek, kd_rek2) VALUES (?, ?, ?, ?)',
            [data.kode_kategori.trim(), data.nama_kategori.trim(), data.kd_rek.trim(), data.kd_rek2.trim()]
        )
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

async function deleteKategoriPemasukan(kode_kategori) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM kategori_pemasukan_lain WHERE kode_kategori = ?', [kode_kategori])
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

// --- KELOMPOK KATEGORI PENGELUARAN HARIAN ---
async function listKategoriPengeluaran() {
    const db = await DatabaseService.get()
    const res = await db.query(`
        SELECT k.kode_kategori, k.nama_kategori, k.kd_rek, r1.nm_rek, k.kd_rek2, r2.nm_rek AS nm_rek2
        FROM kategori_pengeluaran_harian k
        LEFT JOIN rekening r1 ON k.kd_rek = r1.kd_rek
        LEFT JOIN rekening r2 ON k.kd_rek2 = r2.kd_rek
        ORDER BY k.kode_kategori ASC
    `)
    return res.rows
}

async function createKategoriPengeluaran(data) {
    if (!data.kode_kategori?.trim()) return { success: false, message: 'Kode kategori tidak boleh kosong' }
    if (!data.nama_kategori?.trim()) return { success: false, message: 'Nama kategori tidak boleh kosong' }
    if (!data.kd_rek?.trim()) return { success: false, message: 'Akun debet tidak boleh kosong' }
    if (!data.kd_rek2?.trim()) return { success: false, message: 'Akun kredit (kontra akun) tidak boleh kosong' }
    
    const db = await DatabaseService.get()
    try {
        await db.query(
            'INSERT INTO kategori_pengeluaran_harian (kode_kategori, nama_kategori, kd_rek, kd_rek2) VALUES (?, ?, ?, ?)',
            [data.kode_kategori.trim(), data.nama_kategori.trim(), data.kd_rek.trim(), data.kd_rek2.trim()]
        )
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

async function deleteKategoriPengeluaran(kode_kategori) {
    const db = await DatabaseService.get()
    try {
        await db.query('DELETE FROM kategori_pengeluaran_harian WHERE kode_kategori = ?', [kode_kategori])
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

// (Akun Penagihan Piutang tidak dibuat backend terpisah karena di Java hanya table biasa dan CRUD minimal, 
//  kita group ke master akun juga nanti jika diperlukan, tapi ini 6 master kunci dulu).

export default { 
    listAkunBayar, createAkunBayar, deleteAkunBayar,
    listAkunPiutang, createAkunPiutang, deleteAkunPiutang,
    listAkunBayarHutang, createAkunBayarHutang, deleteAkunBayarHutang,
    listAkunAset, createAkunAset, deleteAkunAset,
    listKategoriPemasukan, createKategoriPemasukan, deleteKategoriPemasukan,
    listKategoriPengeluaran, createKategoriPengeluaran, deleteKategoriPengeluaran
}
