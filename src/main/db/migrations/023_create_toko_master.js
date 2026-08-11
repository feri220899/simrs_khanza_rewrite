// Toko — src/toko/ (33 file, investigasi penuh selesai, lihat Khanza.md
// section 14). TERNYATA sistem POS lengkap (Penjualan/Pembelian/Pemesanan/
// Piutang/Retur), TAPI hampir semua transaksi finansialnya otomatis posting
// jurnal ke modul Keuangan yang BELUM dibangun (Fase 3, section 13). KEPUTUSAN
// (dari user): fokus dulu ke MASTER DATA + STOK OPNAME (dua-duanya TIDAK
// menyentuh jurnal sama sekali di Java asli) — modul transaksi (Penjualan,
// Pembelian, Pemesanan, Piutang, Retur*, Sirkulasi/laporan yang bergantung
// tabel transaksi itu) DITUNDA sampai Keuangan/jurnal ada, biar tidak ada
// bagian setengah-jadi yang diam-diam skip posting akuntansi.
//
// `toko_setharga` (persentase markup harga jual) SUDAH ADA dari migration 008
// — dipakai lagi di sini utk auto-hitung harga jual TokoBarang, TIDAK dibuat
// ulang.
//
// `kode_sat` (satuan barang) SENGAJA jadi teks bebas (bukan FK ke tabel
// master satuan) — tabel `kodesatuan` di Java asli itu SHARED lintas modul
// (dipakai juga oleh Farmasi/`src/inventory/`), belum diinvestigasi/dibangun
// versi Postgres-nya. Bikin taksonomi lokal sendiri di sini cuma bakal
// nyimpang dari sistem satuan yang sebenarnya nanti dibangun district-wide
// (kemungkinan bareng Fase 6 Farmasi) — mending teks bebas dulu.
export default {
    name: '023_create_toko_master',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS tokojenisbarang (
                kd_jenis VARCHAR(20) PRIMARY KEY,
                nm_jenis VARCHAR(150) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tokosuplier (
                kode_suplier  VARCHAR(20) PRIMARY KEY,
                nama_suplier  VARCHAR(150) NOT NULL,
                alamat        TEXT,
                kota          VARCHAR(100),
                no_telp       VARCHAR(30),
                nama_bank     VARCHAR(100),
                rekening      VARCHAR(50)
            );

            CREATE TABLE IF NOT EXISTS tokomember (
                no_member VARCHAR(20) PRIMARY KEY,
                nama      VARCHAR(150) NOT NULL,
                jk        CHAR(1) CHECK (jk IN ('L','P')),
                tmp_lahir VARCHAR(100),
                tgl_lahir DATE,
                alamat    TEXT,
                no_telp   VARCHAR(30) NOT NULL,
                email     VARCHAR(150)
            );

            -- Kolom aktif (boolean) menggantikan kolom status char('0'/'1')
            -- di Java asli — representasi internal lebih idiomatis Postgres,
            -- perilaku SAMA (soft-delete via flag, bukan hard delete, ada
            -- fitur restore utk role tertentu).
            CREATE TABLE IF NOT EXISTS tokobarang (
                kode_brng   VARCHAR(20) PRIMARY KEY,
                nama_brng   VARCHAR(150) NOT NULL,
                kode_sat    VARCHAR(20) NOT NULL,
                jenis       VARCHAR(20) NOT NULL REFERENCES tokojenisbarang(kd_jenis),
                stok        NUMERIC(15,2) NOT NULL DEFAULT 0,
                dasar       NUMERIC(15,2) NOT NULL DEFAULT 0,
                h_beli      NUMERIC(15,2) NOT NULL DEFAULT 0,
                distributor NUMERIC(15,2) NOT NULL DEFAULT 0,
                grosir      NUMERIC(15,2) NOT NULL DEFAULT 0,
                retail      NUMERIC(15,2) NOT NULL DEFAULT 0,
                aktif       BOOLEAN NOT NULL DEFAULT TRUE
            );

            -- PK komposit (tanggal,kode_brng) replika persis WHERE clause
            -- hapus Java asli (Valid.hapusTable ..."tanggal='..' and kode_brng").
            CREATE TABLE IF NOT EXISTS tokoopname (
                kode_brng   VARCHAR(20) NOT NULL REFERENCES tokobarang(kode_brng),
                tanggal     DATE NOT NULL,
                dasar       NUMERIC(15,2) NOT NULL DEFAULT 0,
                stok        NUMERIC(15,2) NOT NULL DEFAULT 0,
                real        NUMERIC(15,2) NOT NULL DEFAULT 0,
                selisih     NUMERIC(15,2) NOT NULL DEFAULT 0,
                nomihilang  TEXT,
                keterangan  TEXT,
                PRIMARY KEY (tanggal, kode_brng)
            );

            -- Log pergerakan stok (riwayattoko.catatRiwayat di Java asli) —
            -- tidak ada PK natural di aslinya (pure audit log), ditambah
            -- SERIAL id di sini (tidak mengubah perilaku yang terlihat).
            CREATE TABLE IF NOT EXISTS toko_riwayat_barang (
                id         SERIAL PRIMARY KEY,
                kode_brng  VARCHAR(20) NOT NULL REFERENCES tokobarang(kode_brng),
                stok_awal  NUMERIC(15,2) NOT NULL,
                masuk      NUMERIC(15,2) NOT NULL DEFAULT 0,
                keluar     NUMERIC(15,2) NOT NULL DEFAULT 0,
                stok_akhir NUMERIC(15,2) NOT NULL,
                posisi     VARCHAR(50) NOT NULL,
                tanggal    DATE NOT NULL,
                jam        TIME NOT NULL,
                petugas    VARCHAR(50),
                status     VARCHAR(50)
            );
        `)
    },
}
