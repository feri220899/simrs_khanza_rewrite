// 3 tabel taksonomi surat yang KELEWAT di migration 014 (SuratRuang.java,
// SuratStatus.java, SuratBalas.java — luput karena awalnya cuma grep 6 nama
// yang "kelihatan jelas" tanpa cek index lengkap folder src/surat/). Sesuai
// prinsip di Khanza.md: tambahan lewat migration BARU, bukan edit 014.
export default {
    name: '020_add_surat_master_missing',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS surat_ruang (
                kd    VARCHAR(20) PRIMARY KEY,
                ruang VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_status (
                kd     VARCHAR(20) PRIMARY KEY,
                status VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_balas (
                kd    VARCHAR(20) PRIMARY KEY,
                balas VARCHAR(150) NOT NULL
            );
        `)
    },
}
