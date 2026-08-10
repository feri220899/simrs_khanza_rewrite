// Ditelusuri dari src/parkir/DlgParkirBarcode.java: kode_barcode (PK), nomer_kartu.
//
// CATATAN PENTING (temuan dari SOP): DlgParkirMasuk.java (layar "parkir masuk")
// TIDAK PERNAH insert/update ke tabel manapun — dia cuma lookup kode_barcode →
// jenis & tarif, lalu cetak karcis (BtnPrintActionPerformed). Artinya modul
// Parkir Khanza asli TIDAK PUNYA tabel log transaksi masuk/keluar sama sekali;
// waktu masuk cuma tercetak di karcis fisik. Jangan asumsikan ada tabel
// transaksi yang hilang — kalau mau ditambah di versi baru, itu FITUR BARU
// (di luar cakupan "rewrite 1:1"), bukan migrasi data yang hilang.
export default {
    name: '007_create_parkir_barcode',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS parkir_barcode (
                kode_barcode VARCHAR(30) PRIMARY KEY,
                nomer_kartu  VARCHAR(30) NOT NULL
            )
        `)
    },
}
