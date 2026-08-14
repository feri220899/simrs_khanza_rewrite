<script setup>
import { ref, onMounted } from 'vue'
import { Printer, RefreshCcw } from 'lucide-vue-next'
import { useToast } from '../../composables/useToast.js'

const { showToast } = useToast()
const data = ref([])
const loading = ref(false)

const total = ref({
    tersedia: 0, terpakai: 0,
    k1_tersedia: 0, k1_terpakai: 0,
    k2_tersedia: 0, k2_terpakai: 0,
    k3_tersedia: 0, k3_terpakai: 0,
    ku_tersedia: 0, ku_terpakai: 0,
    kvip_tersedia: 0, kvip_terpakai: 0,
    kvvip_tersedia: 0, kvvip_terpakai: 0
})

async function muatData() {
    loading.value = true
    try {
        const res = await window.api.laporan.rl13()
        data.value = res
        
        // Kalkulasi total
        total.value = res.reduce((acc, row) => {
            acc.tersedia += Number(row.tersedia) || 0
            acc.terpakai += Number(row.terpakai) || 0
            acc.k1_tersedia += Number(row.k1_tersedia) || 0
            acc.k1_terpakai += Number(row.k1_terpakai) || 0
            acc.k2_tersedia += Number(row.k2_tersedia) || 0
            acc.k2_terpakai += Number(row.k2_terpakai) || 0
            acc.k3_tersedia += Number(row.k3_tersedia) || 0
            acc.k3_terpakai += Number(row.k3_terpakai) || 0
            acc.ku_tersedia += Number(row.ku_tersedia) || 0
            acc.ku_terpakai += Number(row.ku_terpakai) || 0
            acc.kvip_tersedia += Number(row.kvip_tersedia) || 0
            acc.kvip_terpakai += Number(row.kvip_terpakai) || 0
            acc.kvvip_tersedia += Number(row.kvvip_tersedia) || 0
            acc.kvvip_terpakai += Number(row.kvvip_terpakai) || 0
            return acc
        }, {
            tersedia: 0, terpakai: 0, k1_tersedia: 0, k1_terpakai: 0, k2_tersedia: 0, k2_terpakai: 0,
            k3_tersedia: 0, k3_terpakai: 0, ku_tersedia: 0, ku_terpakai: 0, kvip_tersedia: 0, kvip_terpakai: 0, kvvip_tersedia: 0, kvvip_terpakai: 0
        })
    } catch (e) {
        showToast('Gagal memuat data', 'error')
    } finally {
        loading.value = false
    }
}

function esc(s) {
    return (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c])
}

function cetak() {
    if (data.value.length === 0) { showToast('Tidak ada data untuk dicetak', 'error'); return }
    const w = window.open('', '_blank', 'width=1000,height=700')
    if (!w) { showToast('Popup cetak diblokir browser', 'error'); return }

    let rowsHtml = ''
    data.value.forEach(r => {
        rowsHtml += `
            <tr class="bg-gray">
                <th colspan="2" class="text-left">${esc(r.nm_bangsal)}</th>
                <th class="text-center">${r.tersedia}</th>
                <th class="text-center">${r.terpakai}</th>
            </tr>
            <tr><td class="text-center">1.</td><td>Kelas 1</td><td class="text-center">${r.k1_tersedia}</td><td class="text-center">${r.k1_terpakai}</td></tr>
            <tr><td class="text-center">2.</td><td>Kelas 2</td><td class="text-center">${r.k2_tersedia}</td><td class="text-center">${r.k2_terpakai}</td></tr>
            <tr><td class="text-center">3.</td><td>Kelas 3</td><td class="text-center">${r.k3_tersedia}</td><td class="text-center">${r.k3_terpakai}</td></tr>
            <tr><td class="text-center">4.</td><td>Kelas Utama</td><td class="text-center">${r.ku_tersedia}</td><td class="text-center">${r.ku_terpakai}</td></tr>
            <tr><td class="text-center">5.</td><td>Kelas VIP</td><td class="text-center">${r.kvip_tersedia}</td><td class="text-center">${r.kvip_terpakai}</td></tr>
            <tr><td class="text-center">6.</td><td>Kelas VVIP</td><td class="text-center">${r.kvvip_tersedia}</td><td class="text-center">${r.kvvip_terpakai}</td></tr>
        `
    })

    const summaryHtml = `
        <tr class="bg-gray font-bold">
            <th colspan="2" class="text-center uppercase">Jumlah Total</th>
            <th class="text-center">${total.value.tersedia}</th>
            <th class="text-center">${total.value.terpakai}</th>
        </tr>
    `

    w.document.write(`<html><head><title>RL 1.3 Ketersediaan Tempat Tidur</title><style>body{font:12px Arial;margin:20px}h1{text-align:center;font-size:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #777;padding:6px;text-align:left}th{background:#eee}.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}.bg-gray{background:#f5f5f5}.uppercase{text-transform:uppercase}@media print{body{margin:10mm}}</style></head><body><h1>RL 1.3 Ketersediaan Dan Keterpakaian Tempat Tidur</h1><table><thead><tr><th colspan="2">Bangsal / Kelas</th><th class="text-center w-24">Tersedia</th><th class="text-center w-24">Terpakai</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot>${summaryHtml}</tfoot></table></body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}

onMounted(muatData)
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-4 shrink-0 flex justify-between items-start">
            <div>
                <h1 class="text-xl font-semibold tracking-tight">RL 1.3 — Ketersediaan Tempat Tidur</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Ketersediaan dan Keterpakaian Tempat Tidur (src/laporan/DlgRL13KetersediaanTempatTidur.java)</p>
            </div>
            <div class="flex gap-2">
                <button class="btn btn-ghost btn-sm text-primary gap-2" @click="muatData">
                    <RefreshCcw class="size-4" /> Segarkan
                </button>
                <button class="btn btn-primary btn-sm gap-2" @click="cetak" :disabled="loading || data.length === 0">
                    <Printer class="size-4" /> Cetak
                </button>
            </div>
        </div>

        <div class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table table-sm">
                        <thead class="sticky top-0 z-10 bg-base-100 shadow-sm">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th colspan="2" class="text-sm font-semibold py-2">Bangsal / Kelas</th>
                                <th class="text-sm font-semibold py-2 w-28 text-center">Tersedia</th>
                                <th class="text-sm font-semibold py-2 w-28 text-center">Terpakai</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="4" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="data.length === 0"><td colspan="4" class="py-16 text-center text-base-content/50">Data tidak ditemukan</td></tr>
                            <template v-else v-for="row in data" :key="row.kd_bangsal">
                                <tr class="bg-base-200/50 border-t border-base-300">
                                    <th colspan="2" class="py-2 text-sm font-semibold">{{ row.nm_bangsal }}</th>
                                    <th class="py-2 text-sm font-semibold text-center">{{ row.tersedia }}</th>
                                    <th class="py-2 text-sm font-semibold text-center">{{ row.terpakai }}</th>
                                </tr>
                                <tr class="border-b border-base-200 hover:bg-base-200/30">
                                    <td class="w-10 text-center text-base-content/50">1.</td>
                                    <td>Kelas 1</td>
                                    <td class="text-center tabular-nums">{{ row.k1_tersedia }}</td>
                                    <td class="text-center tabular-nums">{{ row.k1_terpakai }}</td>
                                </tr>
                                <tr class="border-b border-base-200 hover:bg-base-200/30">
                                    <td class="w-10 text-center text-base-content/50">2.</td>
                                    <td>Kelas 2</td>
                                    <td class="text-center tabular-nums">{{ row.k2_tersedia }}</td>
                                    <td class="text-center tabular-nums">{{ row.k2_terpakai }}</td>
                                </tr>
                                <tr class="border-b border-base-200 hover:bg-base-200/30">
                                    <td class="w-10 text-center text-base-content/50">3.</td>
                                    <td>Kelas 3</td>
                                    <td class="text-center tabular-nums">{{ row.k3_tersedia }}</td>
                                    <td class="text-center tabular-nums">{{ row.k3_terpakai }}</td>
                                </tr>
                                <tr class="border-b border-base-200 hover:bg-base-200/30">
                                    <td class="w-10 text-center text-base-content/50">4.</td>
                                    <td>Kelas Utama</td>
                                    <td class="text-center tabular-nums">{{ row.ku_tersedia }}</td>
                                    <td class="text-center tabular-nums">{{ row.ku_terpakai }}</td>
                                </tr>
                                <tr class="border-b border-base-200 hover:bg-base-200/30">
                                    <td class="w-10 text-center text-base-content/50">5.</td>
                                    <td>Kelas VIP</td>
                                    <td class="text-center tabular-nums">{{ row.kvip_tersedia }}</td>
                                    <td class="text-center tabular-nums">{{ row.kvip_terpakai }}</td>
                                </tr>
                                <tr class="border-b border-base-300 hover:bg-base-200/30">
                                    <td class="w-10 text-center text-base-content/50">6.</td>
                                    <td>Kelas VVIP</td>
                                    <td class="text-center tabular-nums">{{ row.kvvip_tersedia }}</td>
                                    <td class="text-center tabular-nums">{{ row.kvvip_terpakai }}</td>
                                </tr>
                            </template>
                        </tbody>
                        <tfoot v-if="!loading && data.length > 0">
                            <tr class="bg-base-200/70 border-t-2 border-base-300 font-bold text-primary">
                                <th colspan="2" class="py-3 text-center uppercase tracking-wider">Jumlah Total</th>
                                <th class="py-3 text-center text-base tabular-nums">{{ total.tersedia }}</th>
                                <th class="py-3 text-center text-base tabular-nums">{{ total.terpakai }}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>
