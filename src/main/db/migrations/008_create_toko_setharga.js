// Ditelusuri dari src/setting/DlgSetHargaToko.java: tabel `tokosetharga`.
//
// TEMUAN PENTING: modul "Toko" di Khanza asli BUKAN sistem retail/POS lengkap
// (beda dari asumsi awal saat drafting menu.js). Isinya cuma SATU baris
// pengaturan markup harga (distributor/grosir/retail) yang dipakai buat
// menghitung harga jual barang dari katalog `databarang` (src/inventory/) ke
// pembeli non-medis — pola aslinya: hapus baris lama, insert baris baru
// (lihat `Sequel.queryu("delete from tokosetharga")` lalu insert ulang).
// Kalau versi baru mau jadi POS toko yang lebih lengkap (produk, transaksi,
// dst — kayak referensi pos-desktop), itu FITUR BARU di luar cakupan "rewrite
// 1:1", harus didiskusikan dulu, bukan asumsi default.
export default {
    name: '008_create_toko_setharga',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS toko_setharga (
                id          SMALLINT PRIMARY KEY DEFAULT 1,
                distributor NUMERIC(5,2) NOT NULL DEFAULT 0,
                grosir      NUMERIC(5,2) NOT NULL DEFAULT 0,
                retail      NUMERIC(5,2) NOT NULL DEFAULT 0,
                CONSTRAINT toko_setharga_singleton CHECK (id = 1)
            )
        `)
    },
}
