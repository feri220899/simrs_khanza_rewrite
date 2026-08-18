<script setup>
import { computed, onMounted, ref } from 'vue'
import { Printer, Search, TrendingUp } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const today = new Date().toISOString().slice(0, 10)
const awalTahun = `${today.slice(0, 4)}-01-01`
const filter = ref({ tgl_awal: awalTahun, tgl_akhir: today })
const activeTab = ref('labarugi')
const loading = ref(false)

const kosong = { rows: [], total: 0 }
const data = ref({
    pendapatan: kosong, biaya: kosong, labaBersih: 0,
    modal: kosong, modalAkhir: 0,
    aktiva: kosong, pasiva: kosong, totalPasiva: 0
})

const selisihNeraca = computed(() => data.value.aktiva.total - data.value.totalPasiva)
const neracaBalance = computed(() => Math.abs(selisihNeraca.value) < 1)

function money(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

async function load() {
    loading.value = true
    try {
        const result = await window.api.keuangan.labaRugi.get(authStore.token, { ...filter.value })
        data.value = result
        if (result.message) showToast(result.message, 'error')
    } catch (err) {
        showToast(err?.message || 'Gagal memuat laporan', 'error')
    } finally {
        loading.value = false
    }
}

function sectionRows(section) {
    return `<tr><td colspan="2" class="right"><strong>Total ${esc(section.label)}</strong></td><td class="right"><strong>${money(section.data.total)}</strong></td></tr>`
}

function rowsHtml(rows) {
    return rows.map(r => `<tr><td></td><td style="padding-left:${8 + r.depth * 16}px">${esc(r.kd_rek)} ${esc(r.nm_rek)}</td><td class="right">${money(r.saldo_akhir)}</td></tr>`).join('')
}

function printReport() {
    if (!data.value.pendapatan.rows.length && !data.value.biaya.rows.length) return showToast('Tidak ada data untuk dicetak', 'warning')
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    const d = data.value
    const body = `
        <h2>LABA RUGI</h2>
        <table class="data">
            <tr><td colspan="3"><strong>Pendapatan :</strong></td></tr>
            ${rowsHtml(d.pendapatan.rows)}
            ${sectionRows({ label: 'Pendapatan', data: d.pendapatan })}
            <tr><td colspan="3"><strong>Biaya-Biaya :</strong></td></tr>
            ${rowsHtml(d.biaya.rows)}
            ${sectionRows({ label: 'Biaya-Biaya', data: d.biaya })}
            <tr class="total"><td colspan="2" class="right"><strong>Laba Bersih : Total Pendapatan - Total Biaya-Biaya</strong></td><td class="right"><strong>${money(d.labaBersih)}</strong></td></tr>
        </table>
        <h2>PERUBAHAN MODAL</h2>
        <table class="data">
            <tr><td colspan="3"><strong>Modal Awal :</strong></td></tr>
            ${rowsHtml(d.modal.rows)}
            ${sectionRows({ label: 'Modal', data: d.modal })}
            <tr class="total"><td colspan="2" class="right"><strong>Modal Akhir : Laba Bersih + Total Modal</strong></td><td class="right"><strong>${money(d.modalAkhir)}</strong></td></tr>
        </table>
        <h2>NERACA</h2>
        <table class="data">
            <tr><td colspan="3"><strong>Aktiva :</strong></td></tr>
            ${rowsHtml(d.aktiva.rows)}
            ${sectionRows({ label: 'Aktiva', data: d.aktiva })}
            <tr><td colspan="3"><strong>Pasiva :</strong></td></tr>
            ${rowsHtml(d.pasiva.rows)}
            <tr class="total"><td colspan="2" class="right"><strong>Total Pasiva : Pasiva + Modal Akhir</strong></td><td class="right"><strong>${money(d.totalPasiva)}</strong></td></tr>
        </table>`
    win.document.write(`<html><head><title>Laporan Keuangan</title><style>
        body{font:12px Arial;margin:20px;color:#111}
        h1{text-align:center;font-size:18px;margin-bottom:4px}
        h2{font-size:14px;margin:18px 0 6px}
        h3{text-align:center;font-size:13px;font-weight:normal;margin:0 0 12px}
        table.data{width:100%;border-collapse:collapse;margin-bottom:8px}
        table.data td{padding:4px 6px;border-bottom:1px solid #ddd}
        table.data tr.total td{border-top:2px solid #111;border-bottom:0}
        .right{text-align:right}
        @media print{body{margin:10mm}}
    </style></head><body>
        <h1>::[ Laporan Keuangan ]::</h1>
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
            <h1 class="text-xl font-bold flex items-center gap-2"><TrendingUp class="size-6 text-primary" /> Laba Rugi</h1>
            <button class="btn btn-ghost btn-sm gap-2 border border-base-200 bg-base-100" :disabled="loading" @click="printReport"><Printer class="size-4" /> Cetak Laporan</button>
        </div>

        <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body p-4 flex flex-row flex-wrap items-end gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="block text-sm font-medium px-1">Tanggal Awal</label>
                    <input v-model="filter.tgl_awal" type="date" class="input input-bordered input-sm w-full" />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="block text-sm font-medium px-1">Tanggal Akhir</label>
                    <input v-model="filter.tgl_akhir" type="date" class="input input-bordered input-sm w-full" @keyup.enter="load" />
                </div>
                <button class="btn btn-primary btn-sm gap-2" :disabled="loading" @click="load"><Search class="size-4" /> Cari</button>
            </div>
        </div>

        <div class="flex bg-base-200 rounded-xl p-1 w-fit gap-0.5">
            <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer', activeTab === 'labarugi' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'labarugi'">Laba Rugi</button>
            <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer', activeTab === 'modal' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'modal'">Perubahan Modal</button>
            <button :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer', activeTab === 'neraca' ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/50 hover:text-base-content']" @click="activeTab = 'neraca'">Neraca</button>
        </div>

        <div class="relative overflow-auto grow min-h-[300px] border border-base-200 rounded-lg bg-base-100 p-4">
            <div v-if="loading" class="absolute inset-0 z-20 bg-base-100/80 flex items-center justify-center"><span class="loading loading-spinner text-primary"></span></div>

            <table v-if="activeTab === 'labarugi'" class="table table-sm w-full">
                <tbody>
                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold">Pendapatan :</td></tr>
                    <tr v-for="(r, i) in data.pendapatan.rows" :key="`p-${i}`">
                        <td class="w-24 font-mono text-xs">{{ r.kd_rek }}</td>
                        <td :style="{ paddingLeft: (r.depth * 20) + 'px' }">{{ r.nm_rek }}</td>
                        <td class="text-right">{{ money(r.saldo_akhir) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Total Pendapatan</td><td class="text-right">{{ money(data.pendapatan.total) }}</td></tr>

                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold pt-4">Biaya-Biaya :</td></tr>
                    <tr v-for="(r, i) in data.biaya.rows" :key="`b-${i}`">
                        <td class="w-24 font-mono text-xs">{{ r.kd_rek }}</td>
                        <td :style="{ paddingLeft: (r.depth * 20) + 'px' }">{{ r.nm_rek }}</td>
                        <td class="text-right">{{ money(r.saldo_akhir) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Total Biaya-Biaya</td><td class="text-right">{{ money(data.biaya.total) }}</td></tr>

                    <tr class="font-bold border-t-2 border-base-content/30 text-primary">
                        <td colspan="2" class="text-right py-2">Laba Bersih : Total Pendapatan - Total Biaya-Biaya</td>
                        <td class="text-right py-2">{{ money(data.labaBersih) }}</td>
                    </tr>
                </tbody>
            </table>

            <table v-else-if="activeTab === 'modal'" class="table table-sm w-full">
                <tbody>
                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold">Modal Awal :</td></tr>
                    <tr v-for="(r, i) in data.modal.rows" :key="`m-${i}`">
                        <td class="w-24 font-mono text-xs">{{ r.kd_rek }}</td>
                        <td :style="{ paddingLeft: (r.depth * 20) + 'px' }">{{ r.nm_rek }}</td>
                        <td class="text-right">{{ money(r.saldo_akhir) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Total Modal</td><td class="text-right">{{ money(data.modal.total) }}</td></tr>

                    <tr class="font-bold border-t-2 border-base-content/30 text-primary">
                        <td colspan="2" class="text-right py-2">Modal Akhir : Laba Bersih + Total Modal</td>
                        <td class="text-right py-2">{{ money(data.modalAkhir) }}</td>
                    </tr>
                </tbody>
            </table>

            <table v-else class="table table-sm w-full">
                <tbody>
                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold">Aktiva :</td></tr>
                    <tr v-for="(r, i) in data.aktiva.rows" :key="`a-${i}`">
                        <td class="w-24 font-mono text-xs">{{ r.kd_rek }}</td>
                        <td :style="{ paddingLeft: (r.depth * 20) + 'px' }">{{ r.nm_rek }}</td>
                        <td class="text-right">{{ money(r.saldo_akhir) }}</td>
                    </tr>
                    <tr class="font-semibold border-t border-base-300"><td colspan="2" class="text-right">Total Aktiva</td><td class="text-right">{{ money(data.aktiva.total) }}</td></tr>

                    <tr class="bg-base-200/60"><td colspan="3" class="font-semibold pt-4">Pasiva :</td></tr>
                    <tr v-for="(r, i) in data.pasiva.rows" :key="`ps-${i}`">
                        <td class="w-24 font-mono text-xs">{{ r.kd_rek }}</td>
                        <td :style="{ paddingLeft: (r.depth * 20) + 'px' }">{{ r.nm_rek }}</td>
                        <td class="text-right">{{ money(r.saldo_akhir) }}</td>
                    </tr>
                    <tr class="font-bold border-t-2 border-base-content/30 text-primary">
                        <td colspan="2" class="text-right py-2">Total Pasiva : Pasiva + Modal Akhir</td>
                        <td class="text-right py-2">{{ money(data.totalPasiva) }}</td>
                    </tr>
                    <tr>
                        <td colspan="3" class="text-right pt-2">
                            <span :class="['badge badge-sm', neracaBalance ? 'badge-success text-white' : 'badge-error']">
                                {{ neracaBalance ? 'Aktiva = Pasiva + Modal (Balance)' : `Selisih Aktiva vs Pasiva+Modal: ${money(selisihNeraca)}` }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
