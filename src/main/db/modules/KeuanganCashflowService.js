import DatabaseService from '../DatabaseService.js'

// Replika DlgCashflow.java > prosesCari(). Java punya banyak query alternatif
// yang di-comment-out (mis. ikut sertakan rekening Neraca balance='K' di Kas
// Awal, atau tambahkan mutasi jurnal ke Kas Awal) — HANYA versi yang aktif
// (tidak dikomentari) yang direplikasi di sini, bukan versi yang dimatikan.
//
// Tiga section, definisi PERSIS Java (bukan ditebak):
// A. Kas Awal   = SUM(rekeningtahun.saldo_awal) tahun berjalan, rekening tipe
//    Neraca(N) balance Debet(D) SAJA — bukan cuma akun kas/bank, tapi SEMUA
//    akun N/D (quirk Java, sengaja direplikasi apa adanya). Baris dgn nilai 0
//    di-skip (Java: `if(!(debkred==0))`).
// B. Kas Masuk  = per akun Pendapatan (R/K) yang PUNYA mutasi jurnal di
//    periode (dari GROUP BY hasil join ke jurnal — akun tanpa mutasi di
//    periode ini TIDAK muncul sama sekali meski py saldo_awal), nilai =
//    (kredit-debet periode) + saldo_awal tahun berjalan akun itu. Tidak ada
//    skip nilai-0 di section ini (beda dari section A).
// C. Kas Keluar = sama seperti B tapi akun Biaya (R/D), nilai = (debet-kredit
//    periode) + saldo_awal tahun berjalan.
// Total Kas = Kas Awal + (Kas Masuk - Kas Keluar).
async function get({ tgl_awal, tgl_akhir }) {
    const empty = { rows: [], total: 0 }
    if (!tgl_awal || !tgl_akhir) {
        return { kasAwal: empty, kasMasuk: empty, kasKeluar: empty, totalKas: 0 }
    }

    const db = await DatabaseService.get()
    const thnAwal = tgl_awal.substring(0, 4)
    const thnAkhir = tgl_akhir.substring(0, 4)

    const [saldoRes, kasAwalRes, kasMasukRes, kasKeluarRes] = await Promise.all([
        db.query('SELECT kd_rek, SUM(saldo_awal) AS saldo_awal FROM rekeningtahun WHERE thn BETWEEN ? AND ? GROUP BY kd_rek', [thnAwal, thnAkhir]),
        db.query(
            `SELECT rekening.kd_rek, rekening.nm_rek, SUM(rekeningtahun.saldo_awal) AS saldo
             FROM rekening INNER JOIN rekeningtahun ON rekening.kd_rek = rekeningtahun.kd_rek
             WHERE rekening.tipe = 'N' AND rekening.balance = 'D'
             AND rekeningtahun.thn BETWEEN ? AND ?
             GROUP BY rekening.kd_rek ORDER BY rekening.kd_rek`,
            [thnAwal, thnAkhir]
        ),
        db.query(
            `SELECT detailjurnal.kd_rek, rekening.nm_rek, (SUM(detailjurnal.kredit) - SUM(detailjurnal.debet)) AS ttl
             FROM jurnal INNER JOIN detailjurnal ON jurnal.no_jurnal = detailjurnal.no_jurnal
             INNER JOIN rekening ON detailjurnal.kd_rek = rekening.kd_rek
             WHERE rekening.tipe = 'R' AND rekening.balance = 'K'
             AND jurnal.tgl_jurnal BETWEEN ? AND ?
             GROUP BY detailjurnal.kd_rek ORDER BY detailjurnal.kd_rek`,
            [tgl_awal, tgl_akhir]
        ),
        db.query(
            `SELECT detailjurnal.kd_rek, rekening.nm_rek, (SUM(detailjurnal.debet) - SUM(detailjurnal.kredit)) AS ttl
             FROM jurnal INNER JOIN detailjurnal ON jurnal.no_jurnal = detailjurnal.no_jurnal
             INNER JOIN rekening ON detailjurnal.kd_rek = rekening.kd_rek
             WHERE rekening.tipe = 'R' AND rekening.balance = 'D'
             AND jurnal.tgl_jurnal BETWEEN ? AND ?
             GROUP BY detailjurnal.kd_rek ORDER BY detailjurnal.kd_rek`,
            [tgl_awal, tgl_akhir]
        )
    ])

    const saldoMap = new Map(saldoRes.rows.map(r => [r.kd_rek, Number(r.saldo_awal || 0)]))

    let kasAwal = 0
    const kasAwalRows = []
    let noA = 1
    for (const r of kasAwalRes.rows) {
        const nilai = Number(r.saldo || 0)
        kasAwal += nilai
        if (nilai !== 0) kasAwalRows.push({ no: noA++, kd_rek: r.kd_rek, nm_rek: r.nm_rek, nilai })
    }

    let penerimaan = 0
    const kasMasukRows = []
    let noB = 1
    for (const r of kasMasukRes.rows) {
        const nilai = Number(r.ttl || 0) + (saldoMap.get(r.kd_rek) || 0)
        penerimaan += nilai
        kasMasukRows.push({ no: noB++, kd_rek: r.kd_rek, nm_rek: r.nm_rek, nilai })
    }

    let pengeluaran = 0
    const kasKeluarRows = []
    let noC = 1
    for (const r of kasKeluarRes.rows) {
        const nilai = Number(r.ttl || 0) + (saldoMap.get(r.kd_rek) || 0)
        pengeluaran += nilai
        kasKeluarRows.push({ no: noC++, kd_rek: r.kd_rek, nm_rek: r.nm_rek, nilai })
    }

    const totalKas = kasAwal + penerimaan - pengeluaran

    return {
        kasAwal: { rows: kasAwalRows, total: kasAwal },
        kasMasuk: { rows: kasMasukRows, total: penerimaan },
        kasKeluar: { rows: kasKeluarRows, total: pengeluaran },
        totalKas
    }
}

export default { get }
