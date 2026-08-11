// Ditelusuri dari webapps/surat/pages/{input,input2,list,list2}.php (SOP —
// SuratMasuk.java/SuratKeluar.java sendiri TIDAK pernah nyentuh DB, cuma
// shell JavaFX WebView, lihat Khanza.md > "Arsitektur Hybrid WebView").
// INSERT di PHP-nya positional ("INSERT INTO tabel VALUES (...)"), jadi
// urutan kolom di bawah ini HARUS SAMA PERSIS urutan value yang di-insert.
//
// `file_url`: nama kolom asli (BUKAN "dokumen" — itu cuma nama variabel PHP,
// ketahuan dari SELECT di list.php/list2.php yang pakai nama file_url). Di
// Postgres ini nyimpan OBJECT KEY MinIO (bukan path lokal PHP asli, lihat
// Khanza.md > MinIO) — presigned URL di-generate on-demand, bukan disimpan.
//
// `surat_indeks` TIDAK dipakai sebagai FK di sini — 8 dari 9 taksonomi
// terpakai (rak/lemari/klasifikasi/sifat/map/ruang/status/balas), indeks
// ternyata tidak direferensikan sama sekali di kedua form ini.
export default {
    name: '022_create_surat_masuk_keluar',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS surat_masuk (
                no_urut            VARCHAR(15) PRIMARY KEY,
                no_surat           VARCHAR(35) NOT NULL UNIQUE,
                asal               VARCHAR(300) NOT NULL,
                tujuan             VARCHAR(300) NOT NULL,
                tgl_surat          DATE NOT NULL,
                perihal            VARCHAR(300) NOT NULL,
                tgl_terima         DATE NOT NULL,
                kd_lemari          VARCHAR(20) NOT NULL REFERENCES surat_lemari(kd),
                kd_rak             VARCHAR(20) NOT NULL REFERENCES surat_rak(kd),
                kd_map             VARCHAR(20) NOT NULL REFERENCES surat_map(kd),
                kd_ruang           VARCHAR(20) NOT NULL REFERENCES surat_ruang(kd),
                kd_sifat           VARCHAR(20) NOT NULL REFERENCES surat_sifat(kd),
                lampiran           VARCHAR(300) NOT NULL,
                tembusan           VARCHAR(300) NOT NULL,
                tgl_deadline_balas DATE NOT NULL,
                kd_balas           VARCHAR(20) NOT NULL REFERENCES surat_balas(kd),
                keterangan         VARCHAR(300) NOT NULL,
                kd_status          VARCHAR(20) NOT NULL REFERENCES surat_status(kd),
                kd_klasifikasi     VARCHAR(20) NOT NULL REFERENCES surat_klasifikasi(kd),
                file_url           TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS surat_keluar (
                no_urut            VARCHAR(15) PRIMARY KEY,
                no_surat           VARCHAR(35) NOT NULL UNIQUE,
                tujuan             VARCHAR(300) NOT NULL,
                tgl_surat          DATE NOT NULL,
                perihal            VARCHAR(300) NOT NULL,
                tgl_kirim          DATE NOT NULL,
                kd_lemari          VARCHAR(20) NOT NULL REFERENCES surat_lemari(kd),
                kd_rak             VARCHAR(20) NOT NULL REFERENCES surat_rak(kd),
                kd_map             VARCHAR(20) NOT NULL REFERENCES surat_map(kd),
                kd_ruang           VARCHAR(20) NOT NULL REFERENCES surat_ruang(kd),
                kd_sifat           VARCHAR(20) NOT NULL REFERENCES surat_sifat(kd),
                lampiran           VARCHAR(300) NOT NULL,
                tembusan           VARCHAR(300) NOT NULL,
                tgl_deadline_balas DATE NOT NULL,
                kd_balas           VARCHAR(20) NOT NULL REFERENCES surat_balas(kd),
                keterangan         VARCHAR(300) NOT NULL,
                kd_status          VARCHAR(20) NOT NULL REFERENCES surat_status(kd),
                kd_klasifikasi     VARCHAR(20) NOT NULL REFERENCES surat_klasifikasi(kd),
                file_url           TEXT NOT NULL
            );
        `)
    },
}
