<script setup>
import { computed, ref, watch } from 'vue'
import { Printer, Search, RotateCcw } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()
const reports = [
    { id: 'rl32', label: 'RL 3.2', title: 'Kunjungan Rawat Darurat', permission: 'rl32', columns: [
        ['jenis','Jenis Pelayanan'],['rujukan','Rujukan'],['nonrujukan','Non Rujukan'],['dirawat','Dirawat'],['dirujuk','Dirujuk'],['pulang','Pulang'],['meninggal','Mati di IGD'],['doa','Doa'],
    ] },
    { id: 'rl33', label: 'RL 3.3', title: 'Kegiatan Kesehatan Gigi dan Mulut', permission: 'rl33', columns: [['jenis','Jenis Kegiatan'],['jumlah','Jumlah']] },
    { id: 'rl34', label: 'RL 3.4', title: 'Kegiatan Kebidanan', permission: 'rl34', columns: [
        ['jenis','Jenis Kegiatan'],['rujukrs','Rujukan RS'],['rujukbidan','Rujukan Bidan'],['rujukpuskesmas','Rujukan Puskesmas'],['rujuklain','Rujukan Faskes Lain'],['rujukhidup','Rujukan Jml Hidup'],['rujukmati','Rujukan Jml Mati'],['rujuktotal','Rujukan Jml Total'],['nonrujukhidup','Non Rjk Jml Hidup'],['nonrujukmati','Non Rjk Jml Mati'],['nonrujuktotal','Non Rjk Jml Ttl'],['dirujuk','Dirujuk'],
    ] },
    { id: 'rl36', label: 'RL 3.6', title: 'Kegiatan Pembedahan', permission: 'rl36', columns: [['jenis','Spesialisasi'],['total','Total'],['khusus','Khusus'],['besar','Besar'],['sedang','Sedang'],['kecil','Kecil']] },
    { id: 'rl37', label: 'RL 3.7', title: 'Kegiatan Radiologi', permission: 'rl37', columns: [['jenis','Jenis Kegiatan'],['jumlah','Jumlah']] },
    { id: 'rl38', label: 'RL 3.8', title: 'Kegiatan Laboratorium', permission: 'rl38', columns: [['jenis','Jenis Kegiatan'],['jumlah','Jumlah']] },
]
const visibleReports = computed(() => reports.filter(item => authStore.can(item.permission)))
const active = ref(visibleReports.value[0]?.id || 'rl32')
const current = computed(() => reports.find(item => item.id === active.value) || reports[0])
const now = new Date()
const tglAwal = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const tglAkhir = ref(now.toISOString().slice(0, 10))
const search = ref('')
const data = ref([])
const loading = ref(false)

const hasTotal = computed(() => ['rl32', 'rl33', 'rl37', 'rl38'].includes(active.value))
const totals = computed(() => {
    const result = {}
    for (const [key] of current.value.columns) {
        if (key !== 'jenis') result[key] = data.value.reduce((sum, row) => sum + Number(row[key] || 0), 0)
    }
    return result
})

async function muatData() {
    if (!tglAwal.value || !tglAkhir.value || tglAwal.value > tglAkhir.value) {
        showToast('Periode tanggal tidak valid', 'error')
        return
    }
    loading.value = true
    try {
        data.value = await window.api.laporan.rl3({ jenis: active.value, tglAwal: tglAwal.value, tglAkhir: tglAkhir.value, search: search.value })
    } catch (err) {
        showToast(err?.message || 'Gagal memuat laporan', 'error')
    } finally {
        loading.value = false
    }
}

function tampilSemua() {
    search.value = ''
    muatData()
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[char])
}

function cetak() {
    if (!data.value.length) return showToast('Tidak ada data yang bisa dicetak', 'error')
    const win = window.open('', '_blank', 'width=1100,height=700')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    const headers = current.value.columns.map(([, label]) => `<th>${esc(label)}</th>`).join('')
    const rows = data.value.map((row, index) => `<tr><td>${index + 1}</td>${current.value.columns.map(([key]) => `<td>${esc(row[key])}</td>`).join('')}</tr>`).join('')
    const total = hasTotal.value ? `<tr class="total"><td></td>${current.value.columns.map(([key]) => key === 'jenis' ? '<td>TOTAL</td>' : `<td>${esc(totals.value[key])}</td>`).join('')}</tr>` : ''
    win.document.write(`<html><head><title>${esc(current.value.label)}</title><style>body{font:11px Arial;margin:18px}h1{text-align:center;font-size:16px;margin:0}p{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #666;padding:5px}th{background:#eee}.total{font-weight:bold;background:#eee}@media print{body{margin:8mm}}</style></head><body><h1>Formulir ${esc(current.value.label)} — ${esc(current.value.title)}</h1><p>Periode ${esc(tglAwal.value)} s.d. ${esc(tglAkhir.value)}</p><table><thead><tr><th>No.</th>${headers}</tr></thead><tbody>${rows}${total}</tbody></table></body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
}

watch(active, () => {
    search.value = ''
    data.value = []
    muatData()
}, { immediate: true })
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-4 shrink-0 flex items-start justify-between">
            <div>
                <h1 class="text-xl font-semibold">RL 3.2–3.8</h1>
                <p class="text-sm text-base-content/60">Laporan kegiatan rumah sakit sesuai modul Java asli</p>
            </div>
            <button class="btn btn-primary btn-sm gap-2" :disabled="loading || !data.length" @click="cetak"><Printer class="size-4" /> Cetak</button>
        </div>

        <div class="tabs tabs-box mb-4 shrink-0">
            <button v-for="report in visibleReports" :key="report.id" class="tab" :class="{ 'tab-active': active === report.id }" @click="active = report.id">{{ report.label }}</button>
        </div>

        <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 mb-4 shrink-0">
            <div class="font-semibold mb-3">{{ current.label }} — {{ current.title }}</div>
            <div class="flex flex-wrap items-end gap-3">
                <label class="form-control"><span class="label-text mb-1">Tanggal Awal</span><input v-model="tglAwal" type="date" class="input input-bordered input-sm" /></label>
                <label class="form-control"><span class="label-text mb-1">Tanggal Akhir</span><input v-model="tglAkhir" type="date" class="input input-bordered input-sm" /></label>
                <label class="form-control"><span class="label-text mb-1">Key Word</span><input v-model="search" class="input input-bordered input-sm" maxlength="100" @keyup.enter="muatData" /></label>
                <button class="btn btn-primary btn-sm gap-2" :disabled="loading" @click="muatData"><Search class="size-4" /> Cari</button>
                <button class="btn btn-ghost btn-sm gap-2" :disabled="loading" @click="tampilSemua"><RotateCcw class="size-4" /> Semua</button>
            </div>
        </div>

        <div class="flex-1 min-h-0 overflow-auto bg-base-100 rounded-2xl border border-base-200 shadow-sm">
            <table class="table table-sm table-pin-rows">
                <thead><tr class="bg-base-200"><th>No.</th><th v-for="[, label] in current.columns" :key="label">{{ label }}</th></tr></thead>
                <tbody>
                    <tr v-if="loading"><td :colspan="current.columns.length + 1" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                    <tr v-else-if="!data.length"><td :colspan="current.columns.length + 1" class="py-16 text-center text-base-content/50">Data tidak ditemukan</td></tr>
                    <tr v-for="(row, index) in data" v-else :key="`${active}-${index}`">
                        <td>{{ active === 'rl38' ? row.no : index + 1 }}</td>
                        <td v-for="[key] in current.columns" :key="key" :class="{ 'pl-8': active === 'rl38' && row.level === 1 && key === 'jenis' }">{{ row[key] }}</td>
                    </tr>
                </tbody>
                <tfoot v-if="!loading && data.length && hasTotal"><tr class="bg-base-200 font-bold"><td></td><td v-for="[key] in current.columns" :key="key">{{ key === 'jenis' ? 'TOTAL' : totals[key] }}</td></tr></tfoot>
            </table>
        </div>
    </div>
</template>
