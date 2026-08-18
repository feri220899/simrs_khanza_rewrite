import DatabaseService from '../DatabaseService.js'

// `row.parent` = induk (subrekening.kd_rek), kd_rek row itu sendiri = anak
// (subrekening.kd_rek2 — PK, satu anak cuma py 1 induk). Dua tahap: bikin
// semua node dulu (query rekening LEFT JOIN => 1 baris pasti ada per akun,
// tidak seperti versi lama yang 1 akun bisa muncul berkali-kali per anak),
// baru sambungkan ke induknya — supaya urutan baris tidak berpengaruh.
function buildAkunTree(rows) {
    const nodes = {}
    const roots = []

    for (const row of rows) {
        nodes[row.kd_rek] = {
            kd_rek: row.kd_rek,
            nm_rek: row.nm_rek,
            tipe: row.tipe,
            balance: row.balance,
            level: Number(row.level || 0),
            saldo_awal: 0,
            mutasi_debet: 0,
            mutasi_kredit: 0,
            saldo_mutasi: 0,
            saldo_akhir: 0,
            children: []
        }
    }

    for (const row of rows) {
        const node = nodes[row.kd_rek]
        if (row.parent && nodes[row.parent]) {
            nodes[row.parent].children.push(node)
        } else {
            roots.push(node)
        }
    }

    return { nodes, roots }
}

function calcAkunTree(node, visiting = new Set(), visited = new Set()) {
    if (!node?.kd_rek) return node
    if (visiting.has(node.kd_rek)) return node
    if (visited.has(node.kd_rek)) return node

    visiting.add(node.kd_rek)

    let saldo_awal = Number(node.saldo_awal || 0)
    let mutasi_debet = Number(node.mutasi_debet || 0)
    let mutasi_kredit = Number(node.mutasi_kredit || 0)

    const validChildren = []
    for (const child of node.children || []) {
        if (!child?.kd_rek || child.kd_rek === node.kd_rek || visiting.has(child.kd_rek)) continue
        validChildren.push(child)
        const c = calcAkunTree(child, visiting, visited)
        saldo_awal += Number(c.saldo_awal || 0)
        mutasi_debet += Number(c.mutasi_debet || 0)
        mutasi_kredit += Number(c.mutasi_kredit || 0)
    }
    node.children = validChildren

    node.saldo_awal = saldo_awal
    node.mutasi_debet = mutasi_debet
    node.mutasi_kredit = mutasi_kredit

    let saldo_mutasi = 0
    if ((node.tipe === 'R' && node.balance === 'K') || node.tipe === 'M' || (node.tipe === 'N' && node.balance === 'K')) {
        saldo_mutasi = mutasi_kredit - mutasi_debet
    } else if ((node.tipe === 'R' && node.balance === 'D') || (node.tipe === 'N' && node.balance === 'D')) {
        saldo_mutasi = mutasi_debet - mutasi_kredit
    }
    
    node.saldo_mutasi = saldo_mutasi
    node.saldo_akhir = saldo_awal + saldo_mutasi

    visiting.delete(node.kd_rek)
    visited.add(node.kd_rek)

    return node
}

async function getAkunNodes(db) {
    const res = await db.query(`SELECT r.kd_rek, r.nm_rek, r.tipe, r.balance, r.level, s.kd_rek AS parent FROM rekening r LEFT JOIN subrekening s ON r.kd_rek = s.kd_rek2 ORDER BY r.kd_rek`)
    return buildAkunTree(res.rows)
}

async function applyMutasi(db, nodes, tgl1, tgl2) {
    const mutasi = await db.query(`SELECT kd_rek, SUM(debet) AS debet, SUM(kredit) AS kredit FROM detailjurnal dj INNER JOIN jurnal j ON dj.no_jurnal = j.no_jurnal WHERE j.tgl_jurnal BETWEEN ? AND ? GROUP BY kd_rek`, [tgl1, tgl2])
    for (const m of mutasi.rows) {
        if (nodes[m.kd_rek]) {
            nodes[m.kd_rek].mutasi_debet = Number(m.debet || 0)
            nodes[m.kd_rek].mutasi_kredit = Number(m.kredit || 0)
        }
    }
}

async function hutang(jenis) {
    const db = await DatabaseService.get()
    let query

    if (jenis === 'farmasi') {
        query = await db.query(`SELECT p.kode_suplier AS id, d.nama_suplier AS nama, SUM(p.tagihan - COALESCE(bp.total, 0)) AS sisa
            FROM pemesanan p JOIN datasuplier d ON p.kode_suplier = d.kode_suplier
            LEFT JOIN (SELECT no_faktur, SUM(besar_bayar) AS total FROM bayar_pemesanan GROUP BY no_faktur) bp ON p.no_faktur = bp.no_faktur
            WHERE p.status IN ('Belum Dibayar', 'Belum Lunas') GROUP BY p.kode_suplier`)
    } else if (jenis === 'nonmedis') {
        query = await db.query(`SELECT p.kode_suplier AS id, d.nama_suplier AS nama, SUM(p.tagihan - COALESCE(bp.total, 0)) AS sisa
            FROM ipsrspemesanan p JOIN ipsrssuplier d ON p.kode_suplier = d.kode_suplier
            LEFT JOIN (SELECT no_faktur, SUM(besar_bayar) AS total FROM bayar_pemesanan_non_medis GROUP BY no_faktur) bp ON p.no_faktur = bp.no_faktur
            WHERE p.status IN ('Belum Dibayar', 'Belum Lunas') GROUP BY p.kode_suplier`)
    } else if (jenis === 'dapur') {
        query = await db.query(`SELECT p.kode_suplier AS id, d.nama_suplier AS nama, SUM(p.tagihan - COALESCE(bp.total, 0)) AS sisa
            FROM dapurpemesanan p JOIN dapursuplier d ON p.kode_suplier = d.kode_suplier
            LEFT JOIN (SELECT no_faktur, SUM(besar_bayar) AS total FROM bayar_pemesanan_dapur GROUP BY no_faktur) bp ON p.no_faktur = bp.no_faktur
            WHERE p.status IN ('Belum Dibayar', 'Belum Lunas') GROUP BY p.kode_suplier`)
    } else if (jenis === 'inventaris') {
        query = await db.query(`SELECT p.kode_suplier AS id, d.nama_suplier AS nama, SUM(p.tagihan - COALESCE(bp.total, 0)) AS sisa
            FROM inventaris_pemesanan p JOIN inventaris_suplier d ON p.kode_suplier = d.kode_suplier
            LEFT JOIN (SELECT no_faktur, SUM(besar_bayar) AS total FROM bayar_pemesanan_inventaris GROUP BY no_faktur) bp ON p.no_faktur = bp.no_faktur
            WHERE p.status IN ('Belum Dibayar', 'Belum Lunas') GROUP BY p.kode_suplier`)
    } else if (jenis === 'lain') {
        query = await db.query(`SELECT p.kode_pemberi_hutang AS id, p.nama_pemberi_hutang AS nama, SUM(b.sisahutang) AS sisa
            FROM beban_hutang_lain b JOIN pemberi_hutang_lain p ON b.kode_pemberi_hutang = p.kode_pemberi_hutang
            WHERE b.status = 'Belum Lunas' GROUP BY p.kode_pemberi_hutang`)
    } else {
        throw new Error(`Jenis hutang tidak valid: ${jenis}`)
    }

    const items = query.rows.map(r => ({ id: r.id, nama: r.nama, sisa: Number(r.sisa || 0) })).filter(r => r.sisa > 0)
    const grandTotal = items.reduce((sum, item) => sum + item.sisa, 0)
    const charts = [{ title: 'Sebaran Hutang', data: items.map(item => ({ label: `${item.nama} (${item.sisa.toLocaleString('id-ID')})`, value: item.sisa })) }]

    return { filter: { jenis }, items, grandTotal, charts }
}

async function piutangBelumLunas(jenis) {
    const db = await DatabaseService.get()
    let query

    if (jenis === 'pasien') {
        query = await db.query(`SELECT p.png_jawab AS nama, SUM(dpp.sisapiutang) AS sisa
            FROM detail_piutang_pasien dpp JOIN piutang_pasien pp ON dpp.no_rawat = pp.no_rawat JOIN reg_periksa rp ON pp.no_rawat = rp.no_rawat JOIN penjab p ON rp.kd_pj = p.kd_pj
            WHERE dpp.sisapiutang >= 1 GROUP BY p.png_jawab`)
    } else if (jenis === 'obat') {
        // Replika listringkasanpiutangobatbelumlunas.php: bayar_piutang TIDAK
        // punya kolom nota_piutang (cuma KEY yang namanya kebetulan sama tapi
        // isinya kolom no_rawat) — join sebenarnya no_rawat=nota_piutang, dan
        // nama pasien diambil dari piutang.nm_pasien langsung (bukan join ke
        // tabel pasien, karena no_rkm_medis kadang "-"/tidak valid).
        // sisa_bersih dihitung PER NOTA dulu (subquery), baru difilter >0
        // SEBELUM di-group per pasien — bukan sum dulu baru filter.
        query = await db.query(`SELECT t.no_rkm_medis, t.nm_pasien AS nama, SUM(t.sisa_bersih) AS sisa
            FROM (
                SELECT piutang.no_rkm_medis, piutang.nm_pasien,
                    (piutang.sisapiutang - (
                        SELECT IFNULL(SUM(bp.besar_cicilan) + SUM(bp.diskon_piutang) + SUM(bp.tidak_terbayar), 0)
                        FROM bayar_piutang bp WHERE bp.no_rawat = piutang.nota_piutang
                    )) AS sisa_bersih
                FROM piutang
            ) AS t
            WHERE t.sisa_bersih > 0
            GROUP BY t.no_rkm_medis, t.nm_pasien`)
    } else {
        throw new Error(`Jenis piutang tidak valid: ${jenis}`)
    }

    const items = query.rows.map(r => ({ id: r.no_rkm_medis || r.nama, nama: r.nama, sisa: Number(r.sisa || 0) })).filter(r => r.sisa > 0)
    const grandTotal = items.reduce((sum, item) => sum + item.sisa, 0)
    const charts = [{ title: 'Sebaran Piutang', data: items.map(item => ({ label: `${item.nama} (${item.sisa.toLocaleString('id-ID')})`, value: item.sisa })) }]

    return { filter: { jenis }, items, grandTotal, charts }
}

async function laporanKeuangan(tahun) {
    const db = await DatabaseService.get()
    const { nodes, roots } = await getAkunNodes(db)
    
    const saldo = await db.query(`SELECT kd_rek, saldo_awal FROM rekeningtahun WHERE thn = ?`, [tahun])
    for (const s of saldo.rows) {
        if (nodes[s.kd_rek]) nodes[s.kd_rek].saldo_awal = Number(s.saldo_awal || 0)
    }

    await applyMutasi(db, nodes, `${tahun}-01-01`, `${tahun}-12-31`)
    
    const visited = new Set()
    roots.forEach(root => calcAkunTree(root, new Set(), visited))

    const result = {
        pendapatan: [], biaya: [],
        totalPendapatan: 0, totalBiaya: 0, labaBersih: 0,
        modal: [],
        totalModal: 0, modalAkhir: 0,
        aktiva: [], pasiva: [],
        totalAktiva: 0, totalPasiva: 0
    }

    for (const r of roots) {
        if (r.tipe === 'R' && r.balance === 'K') { result.pendapatan.push(r); result.totalPendapatan += r.saldo_mutasi }
        else if (r.tipe === 'R' && r.balance === 'D') { result.biaya.push(r); result.totalBiaya += r.saldo_mutasi }
        else if (r.tipe === 'M') { result.modal.push(r); result.totalModal += r.saldo_mutasi }
        else if (r.tipe === 'N' && r.balance === 'D') { result.aktiva.push(r); result.totalAktiva += r.saldo_akhir }
        else if (r.tipe === 'N' && r.balance === 'K') { result.pasiva.push(r); result.totalPasiva += r.saldo_akhir }
    }

    result.labaBersih = result.totalPendapatan - result.totalBiaya
    result.modalAkhir = result.totalModal + result.labaBersih
    result.totalPasiva += result.modalAkhir

    return { filter: { tahun }, ...result }
}

async function rekeningTahun(tahun) {
    const db = await DatabaseService.get()
    const { nodes, roots } = await getAkunNodes(db)
    
    const saldo = await db.query(`SELECT kd_rek, saldo_awal FROM rekeningtahun WHERE thn = ?`, [tahun])
    for (const s of saldo.rows) {
        if (nodes[s.kd_rek]) nodes[s.kd_rek].saldo_awal = Number(s.saldo_awal || 0)
    }

    await applyMutasi(db, nodes, `${tahun}-01-01`, `${tahun}-12-31`)
    const visited = new Set()
    roots.forEach(root => calcAkunTree(root, new Set(), visited))

    return { filter: { tahun }, roots }
}

async function saldoAkunPerBulan(tahun) {
    const db = await DatabaseService.get()
    const { nodes } = await getAkunNodes(db)
    
    const saldo = await db.query(`SELECT kd_rek, saldo_awal FROM rekeningtahun WHERE thn = ?`, [tahun])
    for (const s of saldo.rows) {
        if (nodes[s.kd_rek]) nodes[s.kd_rek].saldo_awal = Number(s.saldo_awal || 0)
    }

    const mutasi = await db.query(`SELECT kd_rek, LEFT(j.tgl_jurnal, 7) AS bln, SUM(debet) AS debet, SUM(kredit) AS kredit FROM detailjurnal dj INNER JOIN jurnal j ON dj.no_jurnal = j.no_jurnal WHERE j.tgl_jurnal BETWEEN ? AND ? GROUP BY kd_rek, bln`, [`${tahun}-01-01`, `${tahun}-12-31`])
    
    const bulan = Array.from({ length: 12 }, (_, i) => `${tahun}-${String(i + 1).padStart(2, '0')}`)
    const items = []

    for (const k in nodes) {
        const node = nodes[k]
        const row = { kd_rek: node.kd_rek, nm_rek: node.nm_rek, tipe: node.tipe, balance: node.balance, level: node.level, saldo_awal: node.saldo_awal, bulan: {} }
        
        let currSaldo = node.saldo_awal
        for (const b of bulan) {
            row.bulan[b] = { debet: 0, kredit: 0, saldo: currSaldo }
        }
        
        items.push(row)
    }

    for (const m of mutasi.rows) {
        const item = items.find(i => i.kd_rek === m.kd_rek)
        if (item && item.bulan[m.bln]) {
            item.bulan[m.bln].debet = Number(m.debet || 0)
            item.bulan[m.bln].kredit = Number(m.kredit || 0)
        }
    }

    for (const item of items) {
        let currSaldo = item.saldo_awal
        for (const b of bulan) {
            const m = item.bulan[b]
            let saldo_mutasi = 0
            if ((item.tipe === 'R' && item.balance === 'K') || item.tipe === 'M' || (item.tipe === 'N' && item.balance === 'K')) {
                saldo_mutasi = m.kredit - m.debet
            } else if ((item.tipe === 'R' && item.balance === 'D') || (item.tipe === 'N' && item.balance === 'D')) {
                saldo_mutasi = m.debet - m.kredit
            }
            currSaldo += saldo_mutasi
            m.saldo = currSaldo
        }
        item.saldo_akhir = currSaldo
    }

    return { filter: { tahun }, bulan, items }
}

export default { hutang, piutangBelumLunas, laporanKeuangan, rekeningTahun, saldoAkunPerBulan }