<script setup>
import { computed, onMounted, ref } from 'vue'
import { Calendar, RefreshCcw, Search } from 'lucide-vue-next'
import EEksekutifPie from '../../../components/EEksekutifPie.vue'
import AppPagination from '../../../components/AppPagination.vue'
import { useToast } from '../../../composables/useToast.js'

const props = defineProps({ mode: { type: String, required: true } })
const title = computed(() => props.mode === 'poli' ? 'Ringkasan Obat Per Poli' : 'Ringkasan Obat Per Dokter')
const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(20)
const status = ref('Semua')
const today = new Date().toISOString().slice(0, 10)
const tgl1 = ref(today)
const tgl2 = ref(today)

async function muatData() {
    loading.value = true
    try {
        data.value = props.mode === 'poli'
            ? await window.api.eeksekutif.ringkasanObatPoliklinik(tgl1.value, tgl2.value)
            : await window.api.eeksekutif.ringkasanObatDokter(tgl1.value, tgl2.value, status.value)
    } catch (err) {
        showToast(err?.message || `Gagal memuat ${title.value}`, 'error')
    } finally {
        loading.value = false
    }
}

const groupField = computed(() => props.mode === 'poli' ? 'nm_poli' : 'nm_dokter')
const filteredItems = computed(() => {
    if (!data.value) return []
    const q = search.value.toLowerCase()
    return data.value.items.filter(item => [item.kode_brng, item.nama_brng, item[groupField.value]].some(v => String(v || '').toLowerCase().includes(q)))
})
const paginatedItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const formatRibuan = v => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v || 0)

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h1 class="text-xl font-semibold">{{ title }}</h1><p class="text-sm text-base-content/60">Biaya obat bersih = total - embalase - tuslah</p></div>
            <form @submit.prevent="muatData" class="flex flex-wrap items-end gap-3 bg-base-100 p-3 rounded-xl border border-base-200 shadow-sm">
                <label class="form-control">
                    <span class="label py-0.5"><span class="label-text text-xs">Tanggal Awal</span></span>
                    <span class="input input-sm input-bordered flex items-center gap-2"><Calendar class="size-4 text-base-content/50" /><input v-model="tgl1" type="date" required /></span>
                </label>
                <label class="form-control">
                    <span class="label py-0.5"><span class="label-text text-xs">Tanggal Akhir</span></span>
                    <input v-model="tgl2" type="date" class="input input-sm input-bordered" required />
                </label>
                <label v-if="mode === 'dokter'" class="form-control">
                    <span class="label py-0.5"><span class="label-text text-xs">Status</span></span>
                    <select v-model="status" class="select select-sm select-bordered"><option>Semua</option><option>Ralan</option><option>Ranap</option></select>
                </label>
                <button type="submit" class="btn btn-primary btn-sm gap-1" :disabled="loading"><RefreshCcw class="size-4" /> Tampilkan</button>
            </form>
        </div>
        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4"><div class="text-lg font-semibold bg-primary/10 text-primary px-4 py-1 rounded-lg">Total: Rp {{ formatRibuan(data.totalBiaya) }}</div></div>
                <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredItems.length" :page-sizes="[10, 20, 50, 100]">
                    <div class="overflow-x-auto border border-base-200 rounded-lg"><table class="table table-sm w-full"><thead class="bg-base-200/50 whitespace-nowrap"><tr><th>No</th><th>{{ mode === 'poli' ? 'Poli' : 'Dokter' }}</th><th>Kode Barang</th><th>Nama Barang</th><th class="text-right">Embalase</th><th class="text-right">Tuslah</th><th class="text-right">Total</th><th class="text-right">Biaya Obat</th></tr></thead><tbody><tr v-if="!paginatedItems.length"><td colspan="8" class="text-center py-8 text-base-content/50">Tidak ada data</td></tr><tr v-for="(item, idx) in paginatedItems" :key="idx"><td>{{ (page - 1) * pageSize + idx + 1 }}</td><td>{{ item[groupField] }}</td><td>{{ item.kode_brng }}</td><td>{{ item.nama_brng }}</td><td class="text-right">{{ formatRibuan(item.embalase) }}</td><td class="text-right">{{ formatRibuan(item.tuslah) }}</td><td class="text-right">{{ formatRibuan(item.total) }}</td><td class="text-right font-semibold">{{ formatRibuan(item.biayaObat) }}</td></tr></tbody></table></div>
                </AppPagination>
            </div>
            <EEksekutifPie :title="mode === 'poli' ? 'Nilai Obat Per Poli' : 'Nilai Obat Per Dokter'" :data="data.chart" />
        </template>
    </div>
</template>