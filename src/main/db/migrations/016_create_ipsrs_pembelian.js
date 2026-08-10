// Header dikonfirmasi dari IPSRSCariPembelian.java (no_faktur, tagihan, tgl_beli,
// kd_rek, ppn, total, meterai, kode_suplier) + DlgRHPembelianIPSRS.java (nip).
// Detail dikonfirmasi dari DlgRHPembelianIPSRS.java (no_faktur, kode_brng,
// kode_sat, jumlah, harga, subtotal, dis, besardis, total).
export default {
    name: '016_create_ipsrs_pembelian',
    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS ipsrspembelian (
                no_faktur    VARCHAR(30) PRIMARY KEY,
                tgl_beli     DATE NOT NULL,
                kode_suplier VARCHAR(20) REFERENCES ipsrssuplier(kode_suplier),
                nip          VARCHAR(30),
                kd_rek       VARCHAR(30),
                ppn          NUMERIC(12,2) DEFAULT 0,
                total        NUMERIC(14,2) DEFAULT 0,
                meterai      NUMERIC(10,2) DEFAULT 0,
                tagihan      NUMERIC(14,2) DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS ipsrsdetailbeli (
                id         SERIAL PRIMARY KEY,
                no_faktur  VARCHAR(30) NOT NULL REFERENCES ipsrspembelian(no_faktur) ON DELETE CASCADE,
                kode_brng  VARCHAR(20) NOT NULL REFERENCES ipsrsbarang(kode_brng),
                kode_sat   VARCHAR(20) REFERENCES ipsrs_satuan(kode_sat),
                jumlah     NUMERIC(12,2) NOT NULL DEFAULT 0,
                harga      NUMERIC(14,2) NOT NULL DEFAULT 0,
                subtotal   NUMERIC(14,2) NOT NULL DEFAULT 0,
                dis        NUMERIC(5,2) DEFAULT 0,
                besardis   NUMERIC(14,2) DEFAULT 0,
                total      NUMERIC(14,2) NOT NULL DEFAULT 0
            );
        `)
    },
}
