import DatabaseService from '../DatabaseService.js'
import LogService from '../../electron/LogService.js'

// Replika DlgLabaRugi.java: Java menghitung tiap baris rekening lewat query
// berjenjang yang di-unroll manual sampai 13 level (subrekening join berulang),
// bukan rekursi sungguhan. Di sini datanya diambil sekali (rekening,
// subrekening, saldo tahun berjalan, mutasi jurnal periode) lalu pohonnya
// dijalani rekursif di JS — hasil angkanya sama persis, cuma query-nya tidak
// N+1 per level/per akun seperti Java.
//
// Formula debkret per section MENGIKUTI arah yang di-hardcode Java (bukan
// dibaca dinamis dari rekening.balance tiap baris): Pendapatan & Pasiva selalu
// kredit-debet, Biaya & Aktiva selalu debet-kredit, Modal SELALU kredit-debet
// meski root query Modal tidak memfilter balance sama sekali (jadi akun M
// dengan balance='D', kalaupun ada, tetap dihitung kredit-debet — quirk Java
// yang sengaja direplikasi, bukan bug baru).

async function get({ tgl_awal, tgl_akhir }) {
    const empty = { rows: [], total: 0 }
    if (!tgl_awal || !tgl_akhir) {
        return {
            pendapatan: empty, biaya: empty, labaBersih: 0,
            modal: empty, modalAkhir: 0,
            aktiva: empty, pasiva: empty, totalPasiva: 0
        }
    }

    try {
    const db = await DatabaseService.get()
    const thnAwal = tgl_awal.substring(0, 4)
    const thnAkhir = tgl_akhir.substring(0, 4)

    const [rekeningRes, subRes, saldoRes, mutasiRes] = await Promise.all([
        db.query('SELECT kd_rek, nm_rek, tipe, balance, level FROM rekening'),
        db.query('SELECT kd_rek, kd_rek2 FROM subrekening'),
        db.query('SELECT kd_rek, SUM(saldo_awal) AS saldo_awal FROM rekeningtahun WHERE thn BETWEEN ? AND ? GROUP BY kd_rek', [thnAwal, thnAkhir]),
        db.query(
            `SELECT dj.kd_rek, SUM(dj.debet) AS debet, SUM(dj.kredit) AS kredit
             FROM detailjurnal dj JOIN jurnal j ON j.no_jurnal = dj.no_jurnal
             WHERE j.tgl_jurnal BETWEEN ? AND ? GROUP BY dj.kd_rek`,
            [tgl_awal, tgl_akhir]
        )
    ])

    const rekeningByKode = new Map(rekeningRes.rows.map(r => [r.kd_rek, r]))
    const saldoMap = new Map(saldoRes.rows.map(r => [r.kd_rek, Number(r.saldo_awal || 0)]))
    const mutasiMap = new Map(mutasiRes.rows.map(r => [r.kd_rek, { debet: Number(r.debet || 0), kredit: Number(r.kredit || 0) }]))

    const childrenMap = new Map()
    for (const s of subRes.rows) {
        if (!childrenMap.has(s.kd_rek)) childrenMap.set(s.kd_rek, [])
        childrenMap.get(s.kd_rek).push(s.kd_rek2)
    }

    function walkSection(tipe, balance, formula) {
        let total = 0
        const rows = []

        function saldoAkhir(kd_rek) {
            const saldoAwal = saldoMap.get(kd_rek) || 0
            const mut = mutasiMap.get(kd_rek) || { debet: 0, kredit: 0 }
            const debkret = formula === 'KD' ? (mut.kredit - mut.debet) : (mut.debet - mut.kredit)
            return saldoAwal + debkret
        }

        function visit(kd_rek, depth) {
            const rek = rekeningByKode.get(kd_rek)
            if (!rek) return
            const akhir = saldoAkhir(kd_rek)
            total += akhir
            rows.push({ kd_rek: rek.kd_rek, nm_rek: rek.nm_rek, depth, saldo_akhir: akhir })

            const children = (childrenMap.get(kd_rek) || [])
                .map(k => rekeningByKode.get(k))
                .filter(r => r && r.level === '1' && r.tipe === tipe && (!balance || r.balance === balance))
                .sort((a, b) => a.kd_rek.localeCompare(b.kd_rek))
            for (const c of children) visit(c.kd_rek, depth + 1)
        }

        const roots = rekeningRes.rows
            .filter(r => r.level === '0' && r.tipe === tipe && (!balance || r.balance === balance))
            .sort((a, b) => a.kd_rek.localeCompare(b.kd_rek))
        for (const r of roots) visit(r.kd_rek, 0)

        return { rows, total }
    }

    const pendapatan = walkSection('R', 'K', 'KD')
    const biaya = walkSection('R', 'D', 'DK')
    const modal = walkSection('M', null, 'KD')
    const aktiva = walkSection('N', 'D', 'DK')
    const pasiva = walkSection('N', 'K', 'KD')

    const labaBersih = pendapatan.total - biaya.total
    const modalAkhir = modal.total + labaBersih
    const totalPasiva = pasiva.total + modalAkhir

    return { pendapatan, biaya, labaBersih, modal, modalAkhir, aktiva, pasiva, totalPasiva }
    } catch (err) {
        LogService.error('[KeuanganLabaRugiService] Error get', { message: err.message, stack: err.stack })
        console.error('[KeuanganLabaRugiService] Error get:', err)
        throw err
    }
}

export default { get }
