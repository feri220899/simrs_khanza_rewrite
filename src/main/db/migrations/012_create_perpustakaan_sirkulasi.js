// Ditelusuri dari src/perpustakaan/PerpustakaanSirkulasi.java — pinjam & kembali
// sama-sama UPDATE ke baris yang sama (bukan insert transaksi terpisah utk
// kembali), key komposit no_anggota+no_inventaris+tgl_pinjam yang dipakai di
// WHERE clause aslinya.
export default {
    name: '012_create_perpustakaan_sirkulasi',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS perpustakaan_peminjaman (
                no_anggota    VARCHAR(30) NOT NULL REFERENCES perpustakaan_anggota(no_anggota),
                no_inventaris VARCHAR(30) NOT NULL REFERENCES perpustakaan_inventaris(no_inventaris),
                tgl_pinjam    DATE NOT NULL,
                tgl_kembali   DATE,
                nip           VARCHAR(30),
                status_pinjam VARCHAR(30) NOT NULL DEFAULT 'Dipinjam',
                PRIMARY KEY (no_anggota, no_inventaris, tgl_pinjam)
            )
        `)
    },
}
