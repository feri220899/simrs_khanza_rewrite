// Ditelusuri dari src/ipsrs/IPSRSSuplier.java (insert 7 kolom) & IPSRSJenis.java,
// plus kolom `nama_suplier`/`nama_brng`/`kode_sat` dikonfirmasi dari JOIN query
// nyata di DlgRHPembelianIPSRS.java (bukan cuma dari insert statement).
export default {
    name: '015_create_ipsrs_suplier_jenis',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS ipsrssuplier (
                kode_suplier VARCHAR(20) PRIMARY KEY,
                nama_suplier VARCHAR(150) NOT NULL,
                alamat       TEXT,
                kota         VARCHAR(100),
                telp         VARCHAR(30),
                bank         VARCHAR(100),
                no_rek       VARCHAR(50)
            );
            CREATE TABLE IF NOT EXISTS ipsrsjenisbarang (
                kd VARCHAR(20) PRIMARY KEY,
                nm VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ipsrs_satuan (
                kode_sat VARCHAR(20) PRIMARY KEY,
                satuan   VARCHAR(50) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ipsrsbarang (
                kode_brng VARCHAR(20) PRIMARY KEY,
                nama_brng VARCHAR(150) NOT NULL,
                jenis     VARCHAR(20) REFERENCES ipsrsjenisbarang(kd),
                kode_sat  VARCHAR(20) REFERENCES ipsrs_satuan(kode_sat)
            );
        `)
    },
}
