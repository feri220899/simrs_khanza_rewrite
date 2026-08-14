<script setup>
import { ref, onMounted } from 'vue'
import { Printer, RefreshCcw, Search } from 'lucide-vue-next'
import { useToast } from '../../composables/useToast.js'
import AppSelect from '../../components/AppSelect.vue'

const { showToast } = useToast()
const data = ref([])
const summary = ref(null)
const loading = ref(false)

const tglAwal = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
const tglAkhir = ref(new Date().toISOString().split('T')[0])
const filterTgl = ref('masuk') // 'masuk' atau 'keluar'
const kdBangsal = ref('')
const optionsBangsal = ref([])

async function loadFilter() {
    try {
        const db = await window.api.ipsrs.jenis.listAll() // Placeholder untuk list bangsal (sebenarnya bukan ipsrs, tapi kita butuh IPC untuk bangsal)
        // Sementara kita pakai rawat_inap api atau buat list bangsal dummy kalau belum ada API-nya
        // Untuk saat ini bangsal kita kosongi dulu opsinya agar user input manual (Atau bisa diambil dari data relasi)
    } catch (e) {
        console.error(e)
    }
}

async function muatData() {
    if (!tglAwal.value || !tglAkhir.value) {
        showToast('Tanggal awal dan akhir harus diisi', 'warning')
        return
    }
    
    loading.value = true
    try {
        const res = await window.api.laporan.borAlos({ 
            tglAwal: tglAwal.value, 
            tglAkhir: tglAkhir.value, 
            filterTgl: filterTgl.value,
            kdBangsal: kdBangsal.value 
        })
        data.value = res.detail || []
        summary.value = res.summary || null
    } catch (e) {
        showToast('Gagal memuat data', 'error')
    } finally {
        loading.value = false
    }
}

function esc(s) {
    return (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c])
}

function formatAngka(num) {
    return Number(num || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function formatTgl(tglStr) {
    if (!tglStr || tglStr === '0000-00-00') return '-'
    const d = new Date(tglStr)
    return isNaN(d) ? tglStr : d.toLocaleDateString('id-ID')
}

function cetak() {
    if (data.value.length === 0) { showToast('Tidak ada data untuk dicetak', 'error'); return }
    const w = window.open('', '_blank', 'width=1000,height=700')
    if (!w) { showToast('Popup cetak diblokir browser', 'error'); return }

    let rowsHtml = ''
    data.value.forEach((r, i) => {
        rowsHtml += `
            <tr class="hover:bg-base-200/30">
                <td class="text-center">${i + 1}</td>
                <td>${esc(r.no_rawat)}</td>
                <td>${esc(r.no_rkm_medis)}</td>
                <td>${esc(r.nm_pasien)}</td>
                <td>${esc(r.kamar)}</td>
                <td class="text-center">${formatTgl(r.tgl_masuk)}</td>
                <td class="text-center">${formatTgl(r.tgl_keluar)}</td>
                <td class="text-center">${esc(r.lama)}</td>
                <td>${esc(r.stts_pulang)}</td>
            </tr>
        `
    })

    const sum = summary.value || {}
    let calcHtml = ''
    
    // Sesuai DlgHitungBOR / DlgHitungALOS
    calcHtml += `
        <tr><td colspan="4" class="text-right">Jumlah Hari Perawatan / Lama Dirawat :</td><td colspan="5" class="text-left font-bold">${formatAngka(sum.hariPerawatan)}</td></tr>
    `
    calcHtml += `
        <tr><td colspan="4" class="text-right">Jumlah Kamar :</td><td colspan="5" class="text-left font-bold">${formatAngka(sum.jumlahKamar)}</td></tr>
        <tr><td colspan="4" class="text-right">Jumlah Hari Dalam Periode :</td><td colspan="5" class="text-left font-bold">${formatAngka(sum.jumlahHari)}</td></tr>
        <tr><td colspan="4" class="text-right">Perhitungan BOR :</td><td colspan="5" class="text-left font-bold">(${formatAngka(sum.hariPerawatan)} / (${formatAngka(sum.jumlahKamar)} X ${formatAngka(sum.jumlahHari)})) X 100% = ${formatAngka(sum.bor)} %</td></tr>
    `
    calcHtml += `
        <tr><td colspan="4" class="text-right">Jumlah Pasien Keluar(Hidup+Mati) :</td><td colspan="5" class="text-left font-bold">${formatAngka(sum.jumlahPasien)}</td></tr>
        <tr><td colspan="4" class="text-right">Perhitungan ALOS :</td><td colspan="5" class="text-left font-bold">${formatAngka(sum.hariPerawatan)} / ${formatAngka(sum.jumlahPasien)} = ${formatAngka(sum.alos)}</td></tr>
    `

    w.document.write(`<html><head><title>Hitung BOR & ALOS</title><style>body{font:12px Arial;margin:20px}h1{text-align:center;font-size:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #777;padding:6px;text-align:left}th{background:#eee}.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}.font-bold{font-weight:bold}@media print{body{margin:10mm}}</style></head><body><h1>Data Hitung BOR & ALOS</h1><p style="text-align:center;margin-top:-10px;">Periode: ${formatTgl(tglAwal.value)} s/d ${formatTgl(tglAkhir.value)} (Berdasarkan Tanggal ${filterTgl.value === 'masuk' ? 'Masuk' : 'Keluar'})</p><table><thead><tr><th class="text-center">No</th><th>No.Rawat</th><th>No.R.M.</th><th>Nama Pasien</th><th>Kamar</th><th class="text-center">Tgl.Masuk</th><th class="text-center">Tgl.Keluar</th><th class="text-center">Lama</th><th>Stts.Pulang</th></tr></thead><tbody>${rowsHtml}${calcHtml}</tbody></table></body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}

onMounted(() => {
    // loadFilter() // load dropdown bangsal jika ada
    muatData()
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-4 shrink-0 flex justify-between items-start">
            <div>
                <h1 class="text-xl font-semibold tracking-tight">BOR / ALOS</h1>
                <p class="text-sm text-base-content/60 mt-0.5">Perhitungan Bed Occupancy Rate dan Average Length of Stay</p>
            </div>
            <div class="flex gap-2">
                <button class="btn btn-primary btn-sm gap-2" @click="cetak" :disabled="loading || data.length === 0">
                    <Printer class="size-4" /> Cetak
                </button>
            </div>
        </div>

        <div class="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
            <!-- Toolbar Filter -->
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 shrink-0 flex flex-wrap gap-4 items-end">
                <div class="form-control w-40">
                    <label class="label py-1"><span class="label-text font-medium">Berdasarkan Tanggal</span></label>
                    <select v-model="filterTgl" class="select select-sm select-bordered w-full">
                        <option value="masuk">Tgl Masuk</option>
                        <option value="keluar">Tgl Keluar</option>
                    </select>
                </div>
                <div class="form-control w-36">
                    <label class="label py-1"><span class="label-text font-medium">Tgl Awal</span></label>
                    <input type="date" v-model="tglAwal" class="input input-sm input-bordered w-full" />
                </div>
                <div class="form-control w-36">
                    <label class="label py-1"><span class="label-text font-medium">Tgl Akhir</span></label>
                    <input type="date" v-model="tglAkhir" class="input input-sm input-bordered w-full" />
                </div>
                <div class="form-control w-64">
                    <label class="label py-1"><span class="label-text font-medium">Kode Bangsal</span></label>
                    <input type="text" v-model="kdBangsal" class="input input-sm input-bordered w-full" placeholder="Kosongkan untuk semua" @keyup.enter="muatData" />
                </div>
                <button class="btn btn-primary btn-sm gap-2" @click="muatData" :disabled="loading">
                    <Search class="size-4" /> Cari
                </button>
            </div>

            <!-- Tabel & Summary -->
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm flex-1 flex flex-col overflow-hidden px-4 py-3">
                <div class="flex-1 min-h-0 overflow-y-auto">
                    <table class="table table-sm table-pin-rows">
                        <thead>
                            <tr class="bg-base-200">
                                <th class="text-center w-12">No</th>
                                <th>No.Rawat</th>
                                <th>No.R.M.</th>
                                <th>Nama Pasien</th>
                                <th>Kamar</th>
                                <th class="text-center">Tgl.Masuk</th>
                                <th class="text-center">Tgl.Keluar</th>
                                <th class="text-center">Lama</th>
                                <th>Stts.Pulang</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="9" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="data.length === 0"><td colspan="9" class="py-16 text-center text-base-content/50">Data tidak ditemukan</td></tr>
                            <template v-else>
                                <tr v-for="(row, i) in data" :key="i" class="hover:bg-base-200/50">
                                    <td class="text-center">{{ i + 1 }}</td>
                                    <td>{{ row.no_rawat }}</td>
                                    <td>{{ row.no_rkm_medis }}</td>
                                    <td>{{ row.nm_pasien }}</td>
                                    <td>{{ row.kamar }}</td>
                                    <td class="text-center">{{ formatTgl(row.tgl_masuk) }}</td>
                                    <td class="text-center">{{ formatTgl(row.tgl_keluar) }}</td>
                                    <td class="text-center">{{ row.lama }}</td>
                                    <td>{{ row.stts_pulang }}</td>
                                </tr>
                            </template>
                        </tbody>
                        <tfoot v-if="summary && data.length > 0">
                            <!-- Rekap BOR -->
                            <tr class="bg-base-200/30">
                                <td colspan="4" class="text-right text-base-content/70">Jumlah Hari Perawatan :</td>
                                <td colspan="5" class="font-bold">{{ formatAngka(summary.hariPerawatan) }}</td>
                            </tr>
                            <tr class="bg-base-200/30">
                                <td colspan="4" class="text-right text-base-content/70">Jumlah Kamar :</td>
                                <td colspan="5" class="font-bold">{{ formatAngka(summary.jumlahKamar) }}</td>
                            </tr>
                            <tr class="bg-base-200/30">
                                <td colspan="4" class="text-right text-base-content/70">Jumlah Hari Dalam Periode :</td>
                                <td colspan="5" class="font-bold">{{ formatAngka(summary.jumlahHari) }}</td>
                            </tr>
                            <tr class="bg-primary/10">
                                <td colspan="4" class="text-right text-primary font-medium">Perhitungan BOR :</td>
                                <td colspan="5" class="text-primary font-bold">
                                    ({{ formatAngka(summary.hariPerawatan) }} / ({{ formatAngka(summary.jumlahKamar) }} X {{ formatAngka(summary.jumlahHari) }})) X 100% = {{ formatAngka(summary.bor) }} %
                                </td>
                            </tr>
                            
                            <!-- Rekap ALOS -->
                            <tr class="bg-base-200/30 border-t-2 border-base-300">
                                <td colspan="4" class="text-right text-base-content/70">Jumlah Pasien Keluar (Hidup+Mati) :</td>
                                <td colspan="5" class="font-bold">{{ formatAngka(summary.jumlahPasien) }}</td>
                            </tr>
                            <tr class="bg-secondary/10">
                                <td colspan="4" class="text-right text-secondary font-medium">Perhitungan ALOS :</td>
                                <td colspan="5" class="text-secondary font-bold">
                                    {{ formatAngka(summary.hariPerawatan) }} / {{ formatAngka(summary.jumlahPasien) }} = {{ formatAngka(summary.alos) }}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>
