import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

// Definisi kunci mapping default per modul (1:1 kolom asli database Khanza)
export const SET_AKUN_CONFIG = {
    ralan: {
        table: 'set_akun_ralan',
        fields: [
            { key: 'Suspen_Piutang_Tindakan_Ralan', label: 'Suspen Piutang Tindakan Ralan' },
            { key: 'Tindakan_Ralan', label: 'Pendapatan Tindakan Ralan' },
            { key: 'Beban_Jasa_Medik_Dokter_Tindakan_Ralan', label: 'Beban Jasa Medik Dokter Ralan' },
            { key: 'Utang_Jasa_Medik_Dokter_Tindakan_Ralan', label: 'Utang Jasa Medik Dokter Ralan' },
            { key: 'Beban_Jasa_Medik_Paramedis_Tindakan_Ralan', label: 'Beban Jasa Medik Paramedis Ralan' },
            { key: 'Utang_Jasa_Medik_Paramedis_Tindakan_Ralan', label: 'Utang Jasa Medik Paramedis Ralan' },
            { key: 'Beban_KSO_Tindakan_Ralan', label: 'Beban KSO Tindakan Ralan' },
            { key: 'Utang_KSO_Tindakan_Ralan', label: 'Utang KSO Tindakan Ralan' },
            { key: 'Beban_Jasa_Sarana_Tindakan_Ralan', label: 'Beban Jasa Sarana Ralan' },
            { key: 'Utang_Jasa_Sarana_Tindakan_Ralan', label: 'Utang Jasa Sarana Ralan' },
            { key: 'HPP_BHP_Tindakan_Ralan', label: 'HPP BHP Tindakan Ralan' },
            { key: 'Persediaan_BHP_Tindakan_Ralan', label: 'Persediaan BHP Tindakan Ralan' },
            { key: 'Beban_Jasa_Menejemen_Tindakan_Ralan', label: 'Beban Jasa Manajemen Ralan' },
            { key: 'Utang_Jasa_Menejemen_Tindakan_Ralan', label: 'Utang Jasa Manajemen Ralan' },
            { key: 'Suspen_Piutang_Obat_Ralan', label: 'Suspen Piutang Obat Ralan' },
            { key: 'Obat_Ralan', label: 'Pendapatan Obat Ralan' },
            { key: 'HPP_Obat_Rawat_Jalan', label: 'HPP Obat Ralan' },
            { key: 'Persediaan_Obat_Rawat_Jalan', label: 'Persediaan Obat Ralan' },
            { key: 'Registrasi_Ralan', label: 'Pendapatan Registrasi Ralan' },
            { key: 'Tambahan_Ralan', label: 'Pendapatan Tambahan Ralan' },
            { key: 'Potongan_Ralan', label: 'Potongan Biaya Ralan' }
        ]
    },
    ranap: {
        table: 'set_akun_ranap',
        fields: [
            { key: 'Suspen_Piutang_Tindakan_Ranap', label: 'Suspen Piutang Tindakan Ranap' },
            { key: 'Tindakan_Ranap', label: 'Pendapatan Tindakan Ranap' },
            { key: 'Beban_Jasa_Medik_Dokter_Tindakan_Ranap', label: 'Beban Jasa Medik Dokter Ranap' },
            { key: 'Utang_Jasa_Medik_Dokter_Tindakan_Ranap', label: 'Utang Jasa Medik Dokter Ranap' },
            { key: 'Beban_Jasa_Medik_Paramedis_Tindakan_Ranap', label: 'Beban Jasa Medik Paramedis Ranap' },
            { key: 'Utang_Jasa_Medik_Paramedis_Tindakan_Ranap', label: 'Utang Jasa Medik Paramedis Ranap' },
            { key: 'Beban_KSO_Tindakan_Ranap', label: 'Beban KSO Tindakan Ranap' },
            { key: 'Utang_KSO_Tindakan_Ranap', label: 'Utang KSO Tindakan Ranap' },
            { key: 'Beban_Jasa_Sarana_Tindakan_Ranap', label: 'Beban Jasa Sarana Ranap' },
            { key: 'Utang_Jasa_Sarana_Tindakan_Ranap', label: 'Utang Jasa Sarana Ranap' },
            { key: 'HPP_BHP_Tindakan_Ranap', label: 'HPP BHP Tindakan Ranap' },
            { key: 'Persediaan_BHP_Tindakan_Ranap', label: 'Persediaan BHP Tindakan Ranap' },
            { key: 'Suspen_Piutang_Obat_Ranap', label: 'Suspen Piutang Obat Ranap' },
            { key: 'Obat_Ranap', label: 'Pendapatan Obat Ranap' },
            { key: 'HPP_Obat_Rawat_Inap', label: 'HPP Obat Ranap' },
            { key: 'Persediaan_Obat_Rawat_Inap', label: 'Persediaan Obat Ranap' },
            { key: 'Registrasi_Ranap', label: 'Pendapatan Registrasi Ranap' },
            { key: 'Service_Ranap', label: 'Pendapatan Service Ranap' },
            { key: 'Tambahan_Ranap', label: 'Pendapatan Tambahan Ranap' },
            { key: 'Potongan_Ranap', label: 'Potongan Biaya Ranap' },
            { key: 'Retur_Obat_Ranap', label: 'Retur Obat Ranap' },
            { key: 'Resep_Pulang_Ranap', label: 'Resep Pulang Ranap' },
            { key: 'Kamar_Inap', label: 'Pendapatan Kamar Inap' }
        ]
    },
    tokoIpsrs: {
        table: 'set_akun',
        fields: [
            { key: 'Pengadaan_Obat', label: 'Hutang Pengadaan Obat' },
            { key: 'Pemesanan_Obat', label: 'Hutang Pemesanan Obat' },
            { key: 'Penjualan_Obat', label: 'Pendapatan Penjualan Obat' },
            { key: 'Piutang_Obat', label: 'Piutang Obat' },
            { key: 'Retur_Ke_Suplayer', label: 'Retur Obat Ke Supplier' },
            { key: 'Pengadaan_Ipsrs', label: 'Hutang Pengadaan IPSRS' },
            { key: 'Stok_Keluar_Ipsrs', label: 'Beban Stok Keluar IPSRS' },
            { key: 'Bayar_Piutang_Pasien', label: 'Kas/Bank Penerimaan Piutang Pasien' },
            { key: 'Penerimaan_NonMedis', label: 'Penerimaan Logistik Non Medis' },
            { key: 'Bayar_Pemesanan_Non_Medis', label: 'Hutang Vendor Non Medis' },
            { key: 'Pengadaan_Toko', label: 'Hutang Pengadaan Toko' },
            { key: 'Bayar_Pemesanan_Toko', label: 'Kas/Bank Bayar Pemesanan Toko' },
            { key: 'Penjualan_Toko', label: 'Pendapatan Penjualan Toko' },
            { key: 'HPP_Barang_Toko', label: 'HPP Barang Toko' },
            { key: 'Persediaan_Barang_Toko', label: 'Persediaan Barang Toko' },
            { key: 'Piutang_Toko', label: 'Piutang Toko' },
            { key: 'Retur_Beli_Toko', label: 'Retur Beli Toko' },
            { key: 'Retur_Jual_Toko', label: 'Retur Jual Toko' }
        ]
    }
}

async function getMappingDefault() {
    const db = await DatabaseService.get()
    const result = {}

    for (const [groupKey, config] of Object.entries(SET_AKUN_CONFIG)) {
        try {
            const res = await db.query(`SELECT * FROM ${config.table} LIMIT 1`)
            result[groupKey] = res.rows.length > 0 ? res.rows[0] : {}
        } catch (e) {
            LogService.warn(`[PengaturanRekening] Gagal load ${config.table}`, { message: e.message })
            console.warn(`[PengaturanRekening] Gagal load ${config.table}:`, e.message)
            result[groupKey] = {}
        }
    }

    return result
}

async function saveMappingDefault(groupKey, data) {
    const config = SET_AKUN_CONFIG[groupKey]
    if (!config) return { success: false, message: `Kelompok mapping '${groupKey}' tidak valid` }

    const db = await DatabaseService.get()
    const client = await db.connect()

    try {
        await client.query('START TRANSACTION')

        const existing = await client.query(`SELECT * FROM ${config.table} LIMIT 1`)
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK')
            return { success: false, message: `Data awal ${config.table} belum ada. Isi lengkap dulu dari aplikasi Khanza asli sebelum diedit parsial di Electron.` }
        }

        const fields = config.fields.map(f => f.key)
        const values = fields.map(k => String(data[k] || existing.rows[0][k] || '').trim())
        const invalid = values.find(v => v === '')
        if (invalid !== undefined) {
            await client.query('ROLLBACK')
            return { success: false, message: 'Masih ada mapping rekening kosong. Pilih rekening untuk semua baris yang tampil.' }
        }

        const sql = `UPDATE ${config.table} SET ${fields.map(k => `${k} = ?`).join(', ')}`
        await client.query(sql, values)

        await client.query('COMMIT')
        return { success: true }
    } catch (error) {
        await client.query('ROLLBACK')
        LogService.error(`[PengaturanRekening] Gagal simpan ${config.table}`, { message: error.message, stack: error.stack })
        console.error(`[PengaturanRekening] Gagal simpan ${config.table}:`, error)
        return { success: false, message: error.message }
    } finally {
        client.release()
    }
}

export default { SET_AKUN_CONFIG, getMappingDefault, saveMappingDefault }
