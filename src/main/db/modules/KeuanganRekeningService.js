import DatabaseService from '../DatabaseService.js'

async function list() {
    const db = await DatabaseService.get()
    // Tampilkan semua rekening, sertakan parent dari subrekening jika ada
    const res = await db.query(`
        SELECT r.kd_rek, r.nm_rek, r.tipe, r.balance, r.level, s.kd_rek AS parent
        FROM rekening r 
        LEFT JOIN subrekening s ON r.kd_rek = s.kd_rek2 
        ORDER BY r.kd_rek ASC
    `)
    return res.rows
}

function validate(data) {
    if (!data.kd_rek?.trim()) return 'Kode rekening tidak boleh kosong'
    if (!data.nm_rek?.trim()) return 'Nama rekening tidak boleh kosong'
    if (!['N', 'R', 'M'].includes(data.tipe)) return 'Tipe harus Neraca (N), Rugi Laba (R), atau Modal (M)'
    if (!['D', 'K'].includes(data.balance)) return 'Balance harus Debet (D) atau Kredit (K)'
    if (!['0', '1'].includes(data.level)) return 'Level tidak valid'
    return null
}

async function create(data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    const client = await db.connect()
    
    try {
        await client.query('START TRANSACTION')
        
        // Cek kode duplikat
        const cek = await client.query('SELECT kd_rek FROM rekening WHERE kd_rek = ?', [data.kd_rek])
        if (cek.rows.length > 0) {
            await client.query('ROLLBACK')
            return { success: false, message: 'Kode rekening sudah terdaftar' }
        }

        // Insert ke rekening
        await client.query(
            'INSERT INTO rekening (kd_rek, nm_rek, tipe, balance, level) VALUES (?, ?, ?, ?, ?)',
            [data.kd_rek.trim(), data.nm_rek.trim(), data.tipe, data.balance, data.level]
        )

        // Jika memiliki parent, insert ke subrekening (parent = kd_rek, child = kd_rek2)
        if (data.parent && data.parent.trim() !== '') {
            const cekParent = await client.query('SELECT kd_rek FROM rekening WHERE kd_rek = ?', [data.parent])
            if (cekParent.rows.length === 0) {
                await client.query('ROLLBACK')
                return { success: false, message: 'Induk rekening tidak ditemukan' }
            }
            await client.query(
                'INSERT INTO subrekening (kd_rek, kd_rek2) VALUES (?, ?)',
                [data.parent.trim(), data.kd_rek.trim()]
            )
        }

        await client.query('COMMIT')
        return { success: true }
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('[RekeningService] Error create:', error)
        return { success: false, message: error.message }
    } finally {
        client.release()
    }
}

async function update(oldKode, data) {
    const err = validate(data)
    if (err) return { success: false, message: err }

    const db = await DatabaseService.get()
    const client = await db.connect()
    
    try {
        await client.query('START TRANSACTION')

        // Jika ganti kode, pastikan kode baru belum ada (kecuali dia sendiri)
        if (oldKode !== data.kd_rek) {
            const cek = await client.query('SELECT kd_rek FROM rekening WHERE kd_rek = ?', [data.kd_rek])
            if (cek.rows.length > 0) {
                await client.query('ROLLBACK')
                return { success: false, message: 'Kode rekening baru sudah dipakai' }
            }
        }

        // Update rekening utama (karena FK subrekening ON UPDATE CASCADE, kd_rek subrekening otomatis ikut)
        await client.query(
            'UPDATE rekening SET kd_rek = ?, nm_rek = ?, tipe = ?, balance = ?, level = ? WHERE kd_rek = ?',
            [data.kd_rek.trim(), data.nm_rek.trim(), data.tipe, data.balance, data.level, oldKode]
        )

        // Hapus mapping parent lama untuk rekening yang sedang diedit
        await client.query('DELETE FROM subrekening WHERE kd_rek2 = ?', [data.kd_rek.trim()])

        // Insert mapping parent baru jika ada
        if (data.parent && data.parent.trim() !== '') {
            if (data.parent.trim() === data.kd_rek.trim()) {
                await client.query('ROLLBACK')
                return { success: false, message: 'Rekening tidak bisa menjadi induk bagi dirinya sendiri' }
            }
            
            const cekParent = await client.query('SELECT kd_rek FROM rekening WHERE kd_rek = ?', [data.parent])
            if (cekParent.rows.length === 0) {
                await client.query('ROLLBACK')
                return { success: false, message: 'Induk rekening tidak ditemukan' }
            }
            await client.query(
                'INSERT INTO subrekening (kd_rek, kd_rek2) VALUES (?, ?)',
                [data.parent.trim(), data.kd_rek.trim()]
            )
        }

        await client.query('COMMIT')
        return { success: true }
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('[RekeningService] Error update:', error)
        return { success: false, message: error.message }
    } finally {
        client.release()
    }
}

async function deleteOne(kode) {
    const db = await DatabaseService.get()
    // ON DELETE CASCADE pada FK subrekening akan otomatis menghapus child relations
    // Namun pastikan tidak ada transaksi jurnal yang terkait
    try {
        const cekJurnal = await db.query('SELECT kd_rek FROM detailjurnal WHERE kd_rek = ? LIMIT 1', [kode])
        if (cekJurnal.rows.length > 0) {
            return { success: false, message: 'Rekening sudah digunakan dalam transaksi jurnal dan tidak dapat dihapus' }
        }
        
        // Cek juga saldo awal
        const cekTahun = await db.query('SELECT kd_rek FROM rekeningtahun WHERE kd_rek = ? LIMIT 1', [kode])
        if (cekTahun.rows.length > 0) {
            return { success: false, message: 'Rekening memiliki data saldo awal dan tidak dapat dihapus' }
        }

        await db.query('DELETE FROM rekening WHERE kd_rek = ?', [kode])
        return { success: true }
    } catch (error) {
        console.error('[RekeningService] Error delete:', error)
        return { success: false, message: error.message }
    }
}

export default { list, create, update, deleteOne }
