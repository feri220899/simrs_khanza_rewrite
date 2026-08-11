// Migration 009-013 dibuat SEBELUM investigasi mendalam src/perpustakaan/ (SOP
// penuh: baca isi lengkap 13 file, bukan cuma tebak dari nama field UI). Hasil
// investigasi ulang menemukan beberapa mismatch nama kolom & satu tabel yang
// bentuknya salah total — diperbaiki di sini, BUKAN mengedit 009-013 langsung
// (migration yang sudah applied tidak boleh diubah, lihat SOP di Khanza.md).
export default {
    name: '021_fix_perpustakaan_schema',
    async up(client) {
        await client.query(`
            -- PerpustakaanKategori.java: kolomnya id_kategori, bukan kode_kategori
            ALTER TABLE perpustakaan_kategori RENAME COLUMN kode_kategori TO id_kategori;

            -- PerpustakaanJenis.java: kolomnya nama_jenis, bukan nm_jenis
            ALTER TABLE perpustakaan_jenis_buku RENAME COLUMN nm_jenis TO nama_jenis;

            -- PerpustakaanPenerbit.java ternyata 6 kolom (bukan 3) -- ada form
            -- kontak lengkap yg kelewat waktu migration awal ditulis
            ALTER TABLE perpustakaan_penerbit
                ADD COLUMN IF NOT EXISTS no_telp VARCHAR(30),
                ADD COLUMN IF NOT EXISTS email VARCHAR(150),
                ADD COLUMN IF NOT EXISTS website_penerbit VARCHAR(150);

            -- PerpustakaanKoleksi.java: field aslinya jml_halaman & id_kategori
            ALTER TABLE perpustakaan_buku RENAME COLUMN halaman TO jml_halaman;
            ALTER TABLE perpustakaan_buku RENAME COLUMN kode_kategori TO id_kategori;

            -- PerpustakaanInventaris.java: nilai combobox asal/status persis ini,
            -- ditambah CHECK constraint (belum ada sama sekali sebelumnya)
            ALTER TABLE perpustakaan_inventaris
                ADD CONSTRAINT perpustakaan_inventaris_asal_check
                    CHECK (asal_buku IN ('Beli','Bantuan','Hibah','-')),
                ADD CONSTRAINT perpustakaan_inventaris_status_check
                    CHECK (status_buku IN ('Ada','Rusak','Hilang','Dipinjam','-'));

            -- PerpustakaanAnggota.java: nilai combobox jenis_anggota persis ini
            ALTER TABLE perpustakaan_anggota
                ADD CONSTRAINT perpustakaan_anggota_jenis_check
                    CHECK (jenis_anggota IN ('Pasien','Pegawai','Umum'));

            -- PerpustakaanSirkulasi.java: status_pinjam cuma 2 nilai TEKS asli
            -- "Masih Dipinjam"/"Sudah Kembali" -- BUKAN "Dipinjam" seperti tebakan awal
            ALTER TABLE perpustakaan_peminjaman ALTER COLUMN status_pinjam SET DEFAULT 'Masih Dipinjam';
            ALTER TABLE perpustakaan_peminjaman
                ADD CONSTRAINT perpustakaan_peminjaman_status_check
                    CHECK (status_pinjam IN ('Masih Dipinjam','Sudah Kembali'));

            -- PerpustakaanDenda.java: kolomnya jenis_denda, bukan nm_denda; nilainya
            -- persentase dari harga buku (bukan nominal tetap)
            ALTER TABLE perpustakaan_denda RENAME COLUMN nm_denda TO jenis_denda;

            -- PerpustakaanPengaturanPeminjaman.java: tabel aslinya 3 kolom, migration
            -- awal cuma bikin denda_perhari -- max_pinjam & lama_pinjam kelewat,
            -- padahal dipakai buat validasi batas pinjam & hitung tanggal jatuh tempo
            ALTER TABLE perpustakaan_set_peminjaman
                ADD COLUMN IF NOT EXISTS max_pinjam INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS lama_pinjam INTEGER NOT NULL DEFAULT 0;

            -- PerpustakaanBayarDenda.java: file migration 013 nebak SATU tabel gabungan
            -- (no_anggota kelewat sama sekali) -- aslinya 2 tabel TERPISAH lewat 2 tab
            -- di dialog yang sama (Denda Keterlambatan vs Denda Lain-lain), tidak ada
            -- data nyata tersimpan di sini (belum ada CRUD-nya), aman didrop & dibuat ulang
            DROP TABLE IF EXISTS perpustakaan_bayar_denda;

            CREATE TABLE perpustakaan_bayar_denda_harian (
                tgl_denda     DATE NOT NULL,
                no_anggota    VARCHAR(30) NOT NULL REFERENCES perpustakaan_anggota(no_anggota),
                no_inventaris VARCHAR(30) NOT NULL REFERENCES perpustakaan_inventaris(no_inventaris),
                keterlambatan INTEGER NOT NULL DEFAULT 0,
                besar_denda   NUMERIC(12,2) NOT NULL DEFAULT 0,
                PRIMARY KEY (tgl_denda, no_anggota, no_inventaris)
            );

            CREATE TABLE perpustakaan_bayar_denda (
                tgl_denda        DATE NOT NULL,
                no_anggota       VARCHAR(30) NOT NULL REFERENCES perpustakaan_anggota(no_anggota),
                no_inventaris    VARCHAR(30) NOT NULL REFERENCES perpustakaan_inventaris(no_inventaris),
                kode_denda       VARCHAR(20) NOT NULL REFERENCES perpustakaan_denda(kode_denda),
                besar_denda      NUMERIC(12,2) NOT NULL DEFAULT 0,
                keterangan_denda TEXT,
                PRIMARY KEY (tgl_denda, no_anggota, no_inventaris, kode_denda)
            );
        `)
    },
}
