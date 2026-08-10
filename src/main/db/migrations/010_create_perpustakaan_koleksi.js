// Ditelusuri dari src/perpustakaan/PerpustakaanKoleksi.java (tabel judul buku)
// dan PerpustakaanInventaris.java (tabel eksemplar fisik per judul — 1 judul
// bisa punya banyak baris inventaris/eksemplar).
export default {
    name: '010_create_perpustakaan_koleksi',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS perpustakaan_buku (
                kode_buku      VARCHAR(20) PRIMARY KEY,
                judul_buku     VARCHAR(255) NOT NULL,
                halaman        INTEGER,
                kode_penerbit  VARCHAR(20) REFERENCES perpustakaan_penerbit(kode_penerbit),
                kode_pengarang VARCHAR(20) REFERENCES perpustakaan_pengarang(kode_pengarang),
                thn_terbit     SMALLINT,
                isbn           VARCHAR(30),
                kode_kategori  VARCHAR(20) REFERENCES perpustakaan_kategori(kode_kategori),
                id_jenis       VARCHAR(20) REFERENCES perpustakaan_jenis_buku(id_jenis)
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_inventaris (
                no_inventaris VARCHAR(30) PRIMARY KEY,
                kode_buku     VARCHAR(20) NOT NULL REFERENCES perpustakaan_buku(kode_buku),
                asal_buku     VARCHAR(100),
                tgl_pengadaan DATE,
                harga         NUMERIC(12,2) DEFAULT 0,
                status_buku   VARCHAR(50),
                kd_ruang      VARCHAR(20) REFERENCES perpustakaan_ruang(kd_ruang),
                no_rak        VARCHAR(20),
                no_box        VARCHAR(20)
            );
        `)
    },
}
