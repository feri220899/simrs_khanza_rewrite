import DatabaseService from '../../DatabaseService.js'

function formatRows(rows, pivotHeaders) {
    const totalByGroup = {}
    const itemsByGroup = {}
    let grandTotal = 0
    const grandPivotTotal = Object.fromEntries(pivotHeaders.map(h => [h, 0]))

    for (const row of rows) {
        const { group, pivot, value } = row
        const numValue = Number(value || 0)

        if (!itemsByGroup[group]) {
            itemsByGroup[group] = {
                label: group,
                total: 0,
                ...Object.fromEntries(pivotHeaders.map(h => [h, 0]))
            }
            totalByGroup[group] = 0
        }

        if (pivotHeaders.includes(pivot)) {
            itemsByGroup[group][pivot] += numValue
            grandPivotTotal[pivot] += numValue
        }

        itemsByGroup[group].total += numValue
        totalByGroup[group] += numValue
        grandTotal += numValue
    }

    const items = Object.values(itemsByGroup)
        .sort((a, b) => a.label.localeCompare(b.label))

    const charts = [
        {
            title: 'Distribusi Berdasarkan Akun',
            data: items.filter(item => item.total > 0).map(item => ({ label: `${item.label} (${item.total.toLocaleString('id-ID')})`, value: item.total }))
        }
    ]

    return { items, grandTotal, grandPivotTotal, charts }
}

async function kasir(tgl1, tgl2, jenis) {
    const db = await DatabaseService.get()
    const pivotBayar = ['Rawat Inap', 'Rawat Jalan', 'Apotek', 'Deposit', 'Pemasukan Lain', 'Lab Kesling']
    const pivotPiutang = ['Rawat Jalan', 'Rawat Inap']
    const pivotClosing = ['Tunai / Kas / Bank', 'Piutang Pasien', 'Piutang Obat']

    let query
    let result

    if (jenis === 'bayar' || jenis === 'rekening_bayar') {
        const groupField = jenis === 'bayar' ? 'ab.nama_bayar' : 'ab.kd_rek'
        query = await db.query(`
            SELECT ab.nama_bayar AS \`group\`, 'Rawat Inap' AS pivot, SUM(dni.besar_bayar) AS value
            FROM tagihan_sadewa ts JOIN detail_nota_inap dni ON ts.no_nota = dni.no_rawat JOIN akun_bayar ab ON dni.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Rawat Jalan' AS pivot, SUM(dnj.besar_bayar) AS value
            FROM tagihan_sadewa ts JOIN detail_nota_jalan dnj ON ts.no_nota = dnj.no_rawat JOIN akun_bayar ab ON dnj.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Apotek' AS pivot, SUM(dj.total + p.ongkir + p.ppn) AS value
            FROM tagihan_sadewa ts JOIN penjualan p ON ts.no_nota = p.nota_jual JOIN detailjual dj ON p.nota_jual = dj.nota_jual JOIN akun_bayar ab ON p.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Deposit' AS pivot, SUM(d.besar_deposit) AS value
            FROM tagihan_sadewa ts JOIN deposit d ON ts.no_nota = d.no_deposit JOIN akun_bayar ab ON d.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT kpl.kd_rek2 AS \`group\`, 'Pemasukan Lain' AS pivot, SUM(pl.besar) AS value
            FROM tagihan_sadewa ts JOIN pemasukan_lain pl ON ts.no_nota = pl.no_masuk JOIN kategori_pemasukan_lain kpl ON pl.kode_kategori = kpl.kode_kategori
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY kpl.kd_rek2
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Lab Kesling' AS pivot, SUM(ldp.besar_bayar) AS value
            FROM tagihan_sadewa ts JOIN labkesling_pembayaran_pengujian_sampel lp ON ts.no_nota = lp.no_pembayaran JOIN labkesling_detail_pembayaran_pengujian_sampel ldp ON lp.no_pembayaran = ldp.no_pembayaran JOIN akun_bayar ab ON ldp.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
        `, [
            `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`,
            `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`
        ])

        if (jenis === 'rekening_bayar') {
            const akunRek = await db.query('SELECT kd_rek, nm_rek FROM rekening')
            const rekMap = Object.fromEntries(akunRek.rows.map(r => [r.kd_rek, r.nm_rek]))
            const akunBayar = await db.query('SELECT nama_bayar, kd_rek FROM akun_bayar')
            const bayarMap = Object.fromEntries(akunBayar.rows.map(r => [r.nama_bayar, r.kd_rek]))

            const newRows = query.rows.map(r => {
                const kd_rek = r.pivot === 'Pemasukan Lain' ? r.group : bayarMap[r.group]
                return { ...r, group: kd_rek ? `${kd_rek} ${rekMap[kd_rek] || ''}` : r.group }
            })
            result = formatRows(newRows, pivotBayar)
        } else {
            result = formatRows(query.rows, pivotBayar)
        }
        result.pivotHeaders = pivotBayar

    } else if (jenis === 'piutang') {
        query = await db.query(`
            SELECT ap.nama_bayar AS \`group\`, 'Rawat Jalan' AS pivot, SUM(dpp.totalpiutang) AS value
            FROM piutang_pasien pp JOIN nota_jalan nj ON pp.no_rawat = nj.no_rawat JOIN detail_piutang_pasien dpp ON pp.no_rawat = dpp.no_rawat JOIN akun_piutang ap ON dpp.nama_bayar = ap.nama_bayar
            WHERE nj.tanggal BETWEEN ? AND ? GROUP BY ap.nama_bayar
            UNION ALL
            SELECT ap.nama_bayar AS \`group\`, 'Rawat Inap' AS pivot, SUM(dpp.totalpiutang) AS value
            FROM piutang_pasien pp JOIN nota_inap ni ON pp.no_rawat = ni.no_rawat JOIN detail_piutang_pasien dpp ON pp.no_rawat = dpp.no_rawat JOIN akun_piutang ap ON dpp.nama_bayar = ap.nama_bayar
            WHERE ni.tanggal BETWEEN ? AND ? GROUP BY ap.nama_bayar
        `, [tgl1, tgl2, tgl1, tgl2])
        result = formatRows(query.rows, pivotPiutang)
        result.pivotHeaders = pivotPiutang

    } else if (jenis === 'closing' || jenis === 'rekening_closing') {
        query = await db.query(`
            SELECT ab.nama_bayar AS \`group\`, 'Tunai / Kas / Bank' AS pivot, SUM(dni.besar_bayar) AS value
            FROM tagihan_sadewa ts JOIN detail_nota_inap dni ON ts.no_nota = dni.no_rawat JOIN akun_bayar ab ON dni.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Tunai / Kas / Bank' AS pivot, SUM(dnj.besar_bayar) AS value
            FROM tagihan_sadewa ts JOIN detail_nota_jalan dnj ON ts.no_nota = dnj.no_rawat JOIN akun_bayar ab ON dnj.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Tunai / Kas / Bank' AS pivot, SUM(dj.total + p.ongkir + p.ppn) AS value
            FROM tagihan_sadewa ts JOIN penjualan p ON ts.no_nota = p.nota_jual JOIN detailjual dj ON p.nota_jual = dj.nota_jual JOIN akun_bayar ab ON p.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Tunai / Kas / Bank' AS pivot, SUM(d.besar_deposit) AS value
            FROM tagihan_sadewa ts JOIN deposit d ON ts.no_nota = d.no_deposit JOIN akun_bayar ab ON d.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT kpl.kd_rek2 AS \`group\`, 'Tunai / Kas / Bank' AS pivot, SUM(pl.besar) AS value
            FROM tagihan_sadewa ts JOIN pemasukan_lain pl ON ts.no_nota = pl.no_masuk JOIN kategori_pemasukan_lain kpl ON pl.kode_kategori = kpl.kode_kategori
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY kpl.kd_rek2
            UNION ALL
            SELECT ab.nama_bayar AS \`group\`, 'Tunai / Kas / Bank' AS pivot, SUM(ldp.besar_bayar) AS value
            FROM tagihan_sadewa ts JOIN labkesling_pembayaran_pengujian_sampel lp ON ts.no_nota = lp.no_pembayaran JOIN labkesling_detail_pembayaran_pengujian_sampel ldp ON lp.no_pembayaran = ldp.no_pembayaran JOIN akun_bayar ab ON ldp.nama_bayar = ab.nama_bayar
            WHERE ts.tgl_bayar BETWEEN ? AND ? GROUP BY ab.nama_bayar
            UNION ALL
            SELECT dpp.nama_bayar AS \`group\`, 'Piutang Pasien' AS pivot, SUM(dpp.totalpiutang) AS value
            FROM piutang_pasien pp JOIN detail_piutang_pasien dpp ON pp.no_rawat = dpp.no_rawat
            WHERE pp.tgl_piutang BETWEEN ? AND ? GROUP BY dpp.nama_bayar
            UNION ALL
            SELECT 'Piutang Obat' AS \`group\`, 'Piutang Obat' AS pivot, SUM(p.sisapiutang - p.sudahdibayar - p.diskonpiutang - p.tidak_terbayar) AS value
            FROM piutang p WHERE p.tgl_piutang BETWEEN ? AND ? AND (p.sisapiutang - p.sudahdibayar - p.diskonpiutang - p.tidak_terbayar) > 0
        `, [
            `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`,
            `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`, `${tgl1} 00:00:00`, `${tgl2} 23:59:59`,
            tgl1, tgl2, tgl1, tgl2
        ])

        if (jenis === 'rekening_closing') {
            const akunRek = await db.query('SELECT kd_rek, nm_rek FROM rekening')
            const rekMap = Object.fromEntries(akunRek.rows.map(r => [r.kd_rek, r.nm_rek]))
            const akunBayar = await db.query('SELECT nama_bayar, kd_rek FROM akun_bayar')
            const bayarMap = Object.fromEntries(akunBayar.rows.map(r => [r.nama_bayar, r.kd_rek]))
            const akunPiutang = await db.query('SELECT nama_bayar, kd_rek FROM akun_piutang')
            const piutangMap = Object.fromEntries(akunPiutang.rows.map(r => [r.nama_bayar, r.kd_rek]))
            const setting = await db.query('SELECT kd_rek_piutang_obat FROM setting LIMIT 1')
            const piutangObatKdRek = setting.rows[0]?.kd_rek_piutang_obat

            const newRows = query.rows.map(r => {
                let kd_rek
                if (r.pivot === 'Piutang Obat') {
                    kd_rek = piutangObatKdRek
                } else if (r.pivot === 'Piutang Pasien') {
                    kd_rek = piutangMap[r.group]
                } else if (r.group.match(/^\d+$/)) { // Pemasukan Lain yang isinya kd_rek2
                    kd_rek = r.group
                } else {
                    kd_rek = bayarMap[r.group]
                }
                return { ...r, group: kd_rek ? `${kd_rek} ${rekMap[kd_rek] || ''}` : r.group }
            })
            result = formatRows(newRows, pivotClosing)
        } else {
            result = formatRows(query.rows, pivotClosing)
        }
        result.pivotHeaders = pivotClosing
    } else {
        throw new Error(`Jenis kasir tidak valid: ${jenis}`)
    }

    return { filter: { tgl1, tgl2, jenis }, ...result }
}

export default { kasir }