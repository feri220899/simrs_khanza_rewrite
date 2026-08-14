<script setup>
import { computed, ref, watch } from 'vue'
import { Printer, Search, RotateCcw } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()
const reports = [
    { id: 'rl4a', label: 'RL 4A', title: 'Morbiditas Rawat Inap', permission: 'rl4a' },
    { id: 'rl4asebab', label: 'RL 4A Sebab', title: 'Morbiditas Rawat Inap - Sebab', permission: 'rl4asebab' },
    { id: 'rl4b', label: 'RL 4B', title: 'Morbiditas Rawat Jalan', permission: 'rl4b' },
    { id: 'rl4bsebab', label: 'RL 4B Sebab', title: 'Morbiditas Rawat Jalan - Sebab', permission: 'rl4bsebab' },
]
const visibleReports = computed(() => reports.filter(item => authStore.can(item.permission)))
const active = ref(visibleReports.value[0]?.id || 'rl4a')
const current = computed(() => reports.find(item => item.id === active.value) || reports[0])
const now = new Date()
const tglAwal = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const tglAkhir = ref(now.toISOString().slice(0, 10))
const dasarTanggal = ref('masuk')
const filter = ref({ poli: '', dokter: '', penjab: '', kabupaten: '', kecamatan: '', kelurahan: '' })
const data = ref([])
const loading = ref(false)

const columns = [
    ['kode', 'No.Daftar Terperinci'], ['penyakit', 'Golongan Sebab Penyakit'], ['hr0s6l', '0-6 hr L'], ['hr0s6p', '0-6 hr P'], ['hr7s28l', '7-28 hr L'], ['hr7s28p', '7-28 hr P'], ['hr28s1thl', '28 hr-<1 th L'], ['hr28s1thp', '28 hr-<1 th P'], ['th1s4l', '1-4 th L'], ['th1s4p', '1-4 th P'], ['th5s14l', '5-14 th L'], ['th5s14p', '5-14 th P'], ['th15s24l', '15-24 th L'], ['th15s24p', '15-24 th P'], ['th25s44l', '25-44 th L'], ['th25s44p', '25-44 th P'], ['th45s64l', '45-64 th L'], ['th45s64p', '45-64 th P'], ['lbth65l', '>65 th L'], ['lbth65p', '>65 th P'], ['totalL', 'LK'], ['totalP', 'PR'], ['hidup', 'Hidup'], ['mati', 'Mati']
]
const kelompokUmur = ['0-6 hr', '7-28hr', '28hr-<1th', '1-4th', '5-14th', '15-24th', '25-44th', '45-64th', '> 65']

function headerCetak() {
    return `<tr><th rowspan="3">No.Urut</th><th rowspan="3">No.Daftar Terperinci</th><th rowspan="3">Golongan Sebab Penyakit</th><th colspan="18">Jumlah Pasien Hidup dan Mati menurut Golongan Umur &amp; Jenis Kelamin</th><th colspan="2">Pasien Keluar (Hidup &amp; Mati) Menurut Jenis Kelamin</th><th rowspan="3">Jumlah Pasien Keluar Hidup (23+24)</th><th rowspan="3">Jumlah Pasien Keluar Mati</th></tr><tr>${kelompokUmur.map(label => `<th colspan="2">${esc(label)}</th>`).join('')}<th rowspan="2">LK</th><th rowspan="2">PR</th></tr><tr>${kelompokUmur.map(() => '<th>L</th><th>P</th>').join('')}</tr><tr>${Array.from({ length: 25 }, (_, index) => `<th>${index + 1}</th>`).join('')}</tr>`
}

const totals = computed(() => {
    const result = {}
    for (const [key] of columns) {
        if (!['kode', 'penyakit'].includes(key)) result[key] = data.value.reduce((sum, row) => sum + Number(row[key] || 0), 0)
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
        data.value = await window.api.laporan.rl4({ jenis: active.value, tglAwal: tglAwal.value, tglAkhir: tglAkhir.value, dasarTanggal: dasarTanggal.value, ...filter.value })
    } catch (err) {
        showToast(err?.message || 'Gagal memuat laporan', 'error')
    } finally {
        loading.value = false
    }
}

function tampilSemua() {
    filter.value = { poli: '', dokter: '', penjab: '', kabupaten: '', kecamatan: '', kelurahan: '' }
    muatData()
}

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])) }

function cetak() {
    if (!data.value.length) return showToast('Tidak ada data yang bisa dicetak', 'error')
    const win = window.open('', '_blank', 'width=1100,height=700')
    if (!win) return showToast('Popup cetak diblokir', 'error')
    const rows = data.value.map((row, index) => `<tr><td>${index + 1}</td>${columns.map(([key]) => `<td>${esc(row[key])}</td>`).join('')}</tr>`).join('')
    const total = `<tr class="total"><td></td>${columns.map(([key]) => ['kode','penyakit'].includes(key) ? `<td>${key === 'penyakit' ? 'TOTAL' : ''}</td>` : `<td>${esc(totals.value[key])}</td>`).join('')}</tr>`
    win.document.write(`<html><head><title>${esc(current.value.title)}</title><style>body{font:11px Arial;margin:18px}h1{text-align:center;font-size:16px;margin:0}p{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #666;padding:4px;font-size:10px;text-align:center}th{background:#fffafa}.total{font-weight:bold;background:#eee}@media print{body{margin:8mm}}</style></head><body><h1>${esc(current.value.title)}</h1><p>Periode ${esc(tglAwal.value)} s.d. ${esc(tglAkhir.value)}</p><table><thead>${headerCetak()}</thead><tbody>${rows}${total}</tbody></table></body></html>`)
    win.document.close(); win.focus(); win.print(); win.close()
}

watch(active, () => {
    filter.value = { poli: '', dokter: '', penjab: '', kabupaten: '', kecamatan: '', kelurahan: '' }
    data.value = []
    muatData()
}, { immediate: true })
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-4 shrink-0 flex items-start justify-between">
            <div>
                <h1 class="text-xl font-semibold">RL 4A / 4B</h1>
                <p class="text-sm text-base-content/60">Laporan morbiditas rawat inap dan rawat jalan</p>
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
                <label v-if="active.startsWith('rl4a')" class="form-control"><span class="label-text mb-1">Berdasarkan</span><select v-model="dasarTanggal" class="select select-bordered select-sm"><option value="masuk">Tanggal Masuk</option><option value="keluar">Tanggal Keluar</option></select></label>
                <template v-else>
                    <label v-for="(label, key) in { poli:'Unit/Poli', dokter:'Dokter', penjab:'Cara Bayar', kabupaten:'Kabupaten/Kota', kecamatan:'Kecamatan', kelurahan:'Kelurahan' }" :key="key" class="form-control min-w-40"><span class="label-text mb-1">{{ label }}</span><input v-model="filter[key]" class="input input-bordered input-sm" @keyup.enter="muatData" /></label>
                </template>
                <button class="btn btn-primary btn-sm gap-2" :disabled="loading" @click="muatData"><Search class="size-4" /> Cari</button>
                <button class="btn btn-ghost btn-sm gap-2" :disabled="loading" @click="tampilSemua"><RotateCcw class="size-4" /> Semua</button>
            </div>
        </div>

        <div class="flex-1 min-h-0 overflow-auto rounded-2xl border border-base-200 shadow-sm">
            <table class="table table-xs table-pin-rows">
                <thead class="text-center whitespace-nowrap font-black">
                    <tr>
                        <th rowspan="3">No.Urut</th>
                        <th rowspan="3">No.Daftar Terperinci</th>
                        <th rowspan="3" class="min-w-64">Golongan Sebab Penyakit</th>
                        <th colspan="18">Jumlah Pasien Hidup dan Mati menurut Golongan Umur &amp; Jenis Kelamin</th>
                        <th colspan="2">Pasien Keluar (Hidup &amp; Mati) Menurut Jenis Kelamin</th>
                        <th rowspan="3" class="whitespace-normal min-w-28">Jumlah Pasien Keluar Hidup (23+24)</th>
                        <th rowspan="3" class="whitespace-normal min-w-24">Jumlah Pasien Keluar Mati</th>
                    </tr>
                    <tr>
                        <th v-for="label in kelompokUmur" :key="label" colspan="2">{{ label }}</th>
                        <th rowspan="2">LK</th>
                        <th rowspan="2">PR</th>
                    </tr>
                    <tr>
                        <template v-for="label in kelompokUmur" :key="`${label}-jk`"><th>L</th><th>P</th></template>
                    </tr>
                    <tr><th v-for="number in 25" :key="number">{{ number }}</th></tr>
                </thead>
                <tbody>
                    <tr v-if="loading"><td :colspan="columns.length + 1" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                    <tr v-else-if="!data.length"><td :colspan="columns.length + 1" class="py-16 text-center text-base-content/50">Data tidak ditemukan</td></tr>
                    <tr v-for="(row, index) in data" v-else :key="`${active}-${index}`">
                        <td>{{ index + 1 }}</td>
                        <td v-for="[key] in columns" :key="key">{{ row[key] }}</td>
                    </tr>
                </tbody>
                <tfoot v-if="!loading && data.length">
                    <tr class="bg-base-200 font-bold"><td></td><td v-for="[key] in columns" :key="key">{{ ['kode','penyakit'].includes(key) ? (key === 'penyakit' ? 'TOTAL' : '') : totals[key] }}</td></tr>
                </tfoot>
            </table>
        </div>
    </div>
</template>
