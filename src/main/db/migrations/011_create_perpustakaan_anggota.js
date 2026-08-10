// Ditelusuri dari src/perpustakaan/PerpustakaanAnggota.java — kolom dicek
// langsung dari SELECT & UPDATE statement-nya (bukan tebakan).
export default {
    name: '011_create_perpustakaan_anggota',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS perpustakaan_anggota (
                no_anggota    VARCHAR(30) PRIMARY KEY,
                nama_anggota  VARCHAR(150) NOT NULL,
                tmp_lahir     VARCHAR(100),
                tgl_lahir     DATE,
                j_kel         VARCHAR(20),
                alamat        TEXT,
                no_telp       VARCHAR(30),
                email         VARCHAR(150),
                tgl_gabung    DATE,
                masa_berlaku  DATE,
                jenis_anggota VARCHAR(50),
                nomer_id      VARCHAR(50)
            )
        `)
    },
}
