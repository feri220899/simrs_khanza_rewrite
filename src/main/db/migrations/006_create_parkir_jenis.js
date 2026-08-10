// Ditelusuri dari src/parkir/DlgParkirJenis.java (Khanza asli, MySQL):
//   kd_parkir (PK), jns_parkir, biaya, jenis
// Nama kolom SENGAJA dipertahankan sama persis dengan aslinya (bukan
// di-Indonesia/Inggris-kan ulang) supaya gampang ditelusuri balik ke kode Java
// kalau ada pertanyaan soal makna field — ikuti SOP di Khanza.md.
export default {
    name: '006_create_parkir_jenis',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS parkir_jenis (
                kd_parkir  VARCHAR(20) PRIMARY KEY,
                jns_parkir VARCHAR(100) NOT NULL,
                biaya      NUMERIC(12,2) NOT NULL DEFAULT 0,
                jenis      VARCHAR(50)
            )
        `)
    },
}
