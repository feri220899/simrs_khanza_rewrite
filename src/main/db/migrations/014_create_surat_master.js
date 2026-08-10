// Ditelusuri dari src/surat/Surat{Rak,Almari,Klasifikasi,Sifat,Map,Indeks}.java —
// semua master 2 kolom (kd, nama) buat taksonomi pengarsipan fisik surat
// (lemari → rak → map, + klasifikasi/sifat/indeks surat).
//
// TEMUAN PENTING (SOP): src/surat/SuratMasuk.java & SuratKeluar.java (~900 baris
// masing-masing) TERNYATA TIDAK MENYENTUH DATABASE SAMA SEKALI — keduanya pakai
// JavaFX WebView (JFXPanel) buat compose surat (mirip editor teks kaya), bukan
// form terstruktur. Begitu juga puluhan template SuratSakit/SuratSehat/Informed
// Consent dst — itu kemungkinan besar dokumen per-pasien (mirip pola Formulir RM
// kontekstual, section 11), bukan arsip surat administratif. JANGAN bikin tabel
// `surat_masuk`/`surat_keluar` reka-reka — itu belum ada dasarnya di kode asli.
// Investigasi lanjutan (gimana JFXPanel-nya nyimpen/nge-print) perlu dilakukan
// terpisah sebelum modul ini benar-benar dimigrasi (lihat Khanza.md Fase 3).
export default {
    name: '014_create_surat_master',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS surat_rak (
                kd  VARCHAR(20) PRIMARY KEY,
                rak VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_lemari (
                kd     VARCHAR(20) PRIMARY KEY,
                lemari VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_klasifikasi (
                kd           VARCHAR(20) PRIMARY KEY,
                klasifikasi  VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_sifat (
                kd    VARCHAR(20) PRIMARY KEY,
                sifat VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_map (
                kd  VARCHAR(20) PRIMARY KEY,
                map VARCHAR(150) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS surat_indeks (
                kd     VARCHAR(20) PRIMARY KEY,
                indeks VARCHAR(150) NOT NULL
            );
        `)
    },
}
