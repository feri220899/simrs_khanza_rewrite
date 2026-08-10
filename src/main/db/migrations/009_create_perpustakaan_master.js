// Ditelusuri dari src/perpustakaan/Perpustakaan{Kategori,Penerbit,Pengarang,Jenis,Ruang}.java.
// Semua master data 2-3 kolom (kode + nama [+ alamat utk penerbit]), pola sama
// seperti parkir_jenis — hapus/insert manual dari UI, bukan generated ID.
export default {
    name: '009_create_perpustakaan_master',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS perpustakaan_kategori (
                kode_kategori VARCHAR(20) PRIMARY KEY,
                nama_kategori VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_penerbit (
                kode_penerbit  VARCHAR(20) PRIMARY KEY,
                nama_penerbit  VARCHAR(150) NOT NULL,
                alamat_penerbit TEXT
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_pengarang (
                kode_pengarang VARCHAR(20) PRIMARY KEY,
                nama_pengarang VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_jenis_buku (
                id_jenis VARCHAR(20) PRIMARY KEY,
                nm_jenis VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_ruang (
                kd_ruang VARCHAR(20) PRIMARY KEY,
                nm_ruang VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS perpustakaan_set_peminjaman (
                id            SMALLINT PRIMARY KEY DEFAULT 1,
                denda_perhari NUMERIC(10,2) NOT NULL DEFAULT 0,
                CONSTRAINT perpustakaan_set_peminjaman_singleton CHECK (id = 1)
            );
        `)
    },
}
