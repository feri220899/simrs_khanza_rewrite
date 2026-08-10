// perpustakaan_denda = MASTER jenis denda (kode, nama, besar) — mirip pola
// parkir_jenis, dicek dari PerpustakaanDenda.java.
// perpustakaan_bayar_denda(_harian) = transaksi pembayaran denda aktual, dicek
// dari kolom yang dipakai PerpustakaanBayarDenda.java (keterlambatan, besar_denda,
// keterangan_denda, join ke perpustakaan_inventaris). Kolom di sini masih perlu
// dicek ulang lebih detail sebelum implementasi final — SOP tetap berlaku.
export default {
    name: '013_create_perpustakaan_denda',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS perpustakaan_denda (
                kode_denda  VARCHAR(20) PRIMARY KEY,
                nm_denda    VARCHAR(150) NOT NULL,
                besar_denda NUMERIC(10,2) NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_bayar_denda (
                id               SERIAL PRIMARY KEY,
                no_inventaris    VARCHAR(30) NOT NULL REFERENCES perpustakaan_inventaris(no_inventaris),
                tgl_bayar        DATE NOT NULL DEFAULT CURRENT_DATE,
                keterlambatan    INTEGER DEFAULT 0,
                besar_denda      NUMERIC(10,2) NOT NULL DEFAULT 0,
                keterangan_denda TEXT
            );
        `)
    },
}
