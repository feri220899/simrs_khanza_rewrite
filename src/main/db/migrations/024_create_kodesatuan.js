// KOREKSI dari migration 023: field `kode_sat` di `tokobarang` sempat dibuat
// teks bebas dengan alasan "kodesatuan ada di src/inventory/ yang besar &
// belum diinvestigasi" — itu keputusan SEPIHAK yang salah (proyek ini rewrite
// 1:1, bukan MVP). Setelah dicek langsung, `src/inventory/DlgSatuan.java`
// (permission `satuan_barang`) ternyata cuma tabel 2 kolom sederhana:
//
//   kodesatuan(kode_sat, satuan)
//
// — SAMA PERSIS pola taksonomi kode+nama yang sudah dipakai berkali-kali di
// proyek ini (TokoJenis, dst). Auto-kode: Valid.autoNomer("kodesatuan","S",2,Kd)
// (row-count based, prefix S, pad 2). Tabel ini SHARED lintas banyak modul
// Java asli (Toko, Dapur, IPSRS, Farmasi/`src/inventory/`, dll) — makanya
// service-nya (`SatuanService.js`) SENGAJA tidak diberi prefix "Toko" meski
// baru dipakai Toko dulu untuk sekarang, biar gampang dipakai ulang modul
// lain nanti tanpa migrasi ulang.
export default {
    name: '024_create_kodesatuan',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS kodesatuan (
                kode_sat VARCHAR(20) PRIMARY KEY,
                satuan   VARCHAR(150) NOT NULL
            );
        `)

        // Backfill: instalasi yang sempat pakai versi lama (kode_sat teks
        // bebas, sebelum FK ini ada) mungkin sudah punya baris `tokobarang`
        // dengan nilai kode_sat yang belum terdaftar di `kodesatuan` — kalau
        // langsung dipasang FK tanpa backfill, migrasi gagal (violates
        // foreign key constraint) dan data lama jadi tersandera. Daftarkan
        // dulu nilai-nilai yang sudah kepakai itu apa adanya (kode = label,
        // bisa diedit user lewat halaman Satuan nanti) sebelum FK dipasang.
        await client.query(`
            INSERT INTO kodesatuan (kode_sat, satuan)
            SELECT DISTINCT kode_sat, kode_sat FROM tokobarang
            WHERE kode_sat IS NOT NULL
            ON CONFLICT (kode_sat) DO NOTHING;
        `)

        await client.query(`
            ALTER TABLE tokobarang
                ADD CONSTRAINT tokobarang_kode_sat_fkey
                FOREIGN KEY (kode_sat) REFERENCES kodesatuan(kode_sat);
        `)
    },
}
