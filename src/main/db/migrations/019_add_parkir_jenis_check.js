// Ditelusuri lebih detail dari DlgParkirJenis.java: kolom `jenis` BUKAN teks
// bebas — combobox "Sistem" cuma punya 2 pilihan: 'Harian' atau 'Jam' (sistem
// tarif per-hari vs per-jam). Migration 006 (sudah applied di tempat lain,
// TIDAK BOLEH diedit) bikin kolom itu VARCHAR biasa — di sini ditambahkan
// CHECK constraint-nya lewat migration baru, sesuai prinsip "jangan pernah
// edit migration yang sudah jalan".
export default {
    name: '019_add_parkir_jenis_check',
    async up(client) {
        await client.query(`
            ALTER TABLE parkir_jenis
            ADD CONSTRAINT parkir_jenis_jenis_check CHECK (jenis IN ('Harian', 'Jam'))
        `)
    },
}
