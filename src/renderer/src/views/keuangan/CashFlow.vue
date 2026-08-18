<script setup>
import { onMounted, ref } from 'vue'
import { Printer, Search, Wallet } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const today = new Date().toISOString().slice(0, 10)
const awalTahun = `${today.slice(0, 4)}-01-01`
const filter = ref({ tgl_awal: awalTahun, tgl_akhir: today })
const loading = ref(false)

const kosong = { rows: [], total: 0 }
const data = ref({ kasAwal: kosong, kasMasuk: kosong, kasKeluar: kosong, totalKas: 0 })

function money(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

async function load() {
    loading.value = true
    try {
        const result = await window.api.keuangan.cashflow.get(authStore.token, { ...filter.value })
        data.value = result
        if (result.message) showToast(result.message, 'error')
    } catch (err) {
        showToast(err?.message || 'Gagal memuat laporan', 'error')
    } finally {
        loading.value = false
    }
}

function rowsHtml(rows) {
    return rows.map(r => `<tr><td></td><td>${r.no}. ${esc(r.kd_rek)} ${esc(r.nm_rek)}</td><td class="right">${money(r.nilai)}</td></tr>`).join('')
}

function printReport() {
    if (!data.value.kasAwal.rows.length && !data.value.kasMasuk.rows.length && !data.value.kasKeluar.rows.length) {
        return showToast('Tidak ada data untuk dicetak', 'warning')
    }
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    const d = data.value
    const body = `
        <table class="data">
            <tr><td colspan="3"><strong>A. Kas Awal :</strong></td></tr>
            ${rowsHtml(d.kasAwal.rows)}
            <tr><td colspan="2" class="right"><strong>Jumlah Total Kas Awal :</strong></td><td class="right"><strong>${money(d.kasAwal.total)}</strong></td></tr>

            <tr><td colspan="3">&nbsp;</td></tr>
            <tr><td colspan="3"><strong>B. Kas Masuk :</strong></td></tr>
            ${rowsHtml(d.kasMasuk.rows)}
            <tr><td colspan="2" class="right"><strong>Jumlah Total Kas Masuk :</strong></td><td class="right"><strong>${money(d.kasMasuk.total)}</strong></td></tr>

            <tr><td colspan="3">&nbsp;</td></tr>
            <tr><td colspan="3"><strong>C. Kas Keluar :</strong></td></tr>
            ${rowsHtml(d.kasKeluar.rows)}
            <tr><td colspan="2" class="right"><strong>Jumlah Total Kas Keluar :</strong></td><td class="right"><strong>${money(d.kasKeluar.total)}</strong></td></tr>

            <tr><td colspan="3">&nbsp;</td></tr>
            <tr class="total"><td colspan="3"><strong>&gt;&gt; Total Kas : A + ( B - C )</strong></td></tr>
            <tr class="total"><td></td><td>${money(d.kasAwal.total)} + ( ${money(d.kasMasuk.total)} - ${money(d.kasKeluar.total)} ) :</td><td class="right"><strong>${money(d.totalKas)}</strong></td></tr>
        </table>`
    win.document.write(`<html><head><title>Arus Kas / Cash Flow</title><style>
        body{font:12px Arial;margin:20px;color:#111}
        h1{text-align:center;font-size:18px;margin-bottom:4px}
        h3{text-align:center;font-size:13px;font-weight:normal;margin:0 0 12px}
        table.data{width:100%;border-collapse:collapse;margin-bottom:8px}
        table.data td{padding:4px 6px;border-bottom:1px solid #ddd}
        table.data tr.total td{border-top:2px solid #111;border-bottom:0}
        .right{text-align:right}
        @media print{body{margin:10mm}}
    </style></head><body>
        <h1>::[ Arus Kas / Cash Flow Perusahaan ]::</h1>
        <h3>Periode ${esc(filter.value.tgl_awal)} s.d. ${esc(filter.value.tgl_akhir)}</h3>
        ${body}
    </body></html>`)
    win.document.close()
    win.focus()
    win.print()
}

onMounted(() => load())
</script>

<template>
    <div class="flex flex-col h-full min-h-0 gap-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold flex items-center gap-2"><Wallet class="size-6 text-primary" /> Cash Flow / Arus Kas</h1>
            <button class="btn btn-ghost btn-sm gap-2 border border-base-200 bg-base-100" :disabled="loading" @click="printReport"><Printer class="size-4" /> Cetak Laporan</button>
        </div>

        <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body p-4 flex flex-row flex-wrap items-end gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="block text-sm font-medium px-1">Tanggal Transaksi / Posting Jurnal — Awal</label>
                    <input v-model="filter.tgl_awal" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="block text-sm font-medium px-1">s.d.</label>
                    <input v-model="filter.tgl_akhir" type="date" class="input input-bordered input-sm w-full" @keyup.enter="load" />
                </div>
                <button class="btn btn-primary btn-sm gap-2" :disabled="loading" @click="load"><Search class="size-4" /> Cari</button>
            </div>
        </div>

        <div class="relative overflow-auto grow min-h-[300px] border border-base-200 rounded-lg bg-base-100 p-4">
            <div v-if="loading" class="absolute inset-0 z-20 bg-base-100/80 flex items-center justify-center"><span class="loading loading-spinner text-primary"></span></div>

            <table class="table table-sm w-full">
                <tbody>
                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold">A. Kas Awal :</td></tr>
                    <tr v-for="r in data.kasAwal.rows" :key="`a-${r.kd_rek}`">
                        <td class="w-10 text-xs text-base-content/50">{{ r.no }}.</td>
                        <td class="font-mono text-xs">{{ r.kd_rek }} <span class="font-sans">{{ r.nm_rek }}</span></td>
                        <td class="text-right">{{ money(r.nilai) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Jumlah Total Kas Awal</td><td class="text-right">{{ money(data.kasAwal.total) }}</td></tr>

                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold pt-4">B. Kas Masuk :</td></tr>
                    <tr v-for="r in data.kasMasuk.rows" :key="`b-${r.kd_rek}`">
                        <td class="w-10 text-xs text-base-content/50">{{ r.no }}.</td>
                        <td class="font-mono text-xs">{{ r.kd_rek }} <span class="font-sans">{{ r.nm_rek }}</span></td>
                        <td class="text-right">{{ money(r.nilai) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Jumlah Total Kas Masuk</td><td class="text-right">{{ money(data.kasMasuk.total) }}</td></tr>

                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold pt-4">C. Kas Keluar :</td></tr>
                    <tr v-for="r in data.kasKeluar.rows" :key="`c-${r.kd_rek}`">
                        <td class="w-10 text-xs text-base-content/50">{{ r.no }}.</td>
                        <td class="font-mono text-xs">{{ r.kd_rek }} <span class="font-sans">{{ r.nm_rek }}</span></td>
                        <td class="text-right">{{ money(r.nilai) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Jumlah Total Kas Keluar</td><td class="text-right">{{ money(data.kasKeluar.total) }}</td></tr>

                    <tr class="font-bold border-t-2 border-base-content/30 text-primary">
                        <td colspan="2" class="text-right py-2">
                            &gt;&gt; Total Kas : A + ( B - C ) &nbsp;
                            <span class="font-normal text-base-content/60 text-xs">
                                ({{ money(data.kasAwal.total) }} + ( {{ money(data.kasMasuk.total) }} - {{ money(data.kasKeluar.total) }} ))
                            </span>
                        </td>
                        <td class="text-right py-2">{{ money(data.totalKas) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
