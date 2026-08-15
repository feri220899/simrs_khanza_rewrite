<script setup>
import { computed, onMounted, ref } from 'vue'
import { Calendar, RefreshCcw, Search } from 'lucide-vue-next'
import EEksekutifPie from '../../../components/EEksekutifPie.vue'
import AppPagination from '../../../components/AppPagination.vue'
import { useToast } from '../../../composables/useToast.js'

const props = defineProps({ title: { type: String, required: true }, jenis: { type: String, required: true } })
const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(20)
const today = new Date().toISOString().slice(0, 10)
const tgl1 = ref(today)
const tgl2 = ref(today)

async function muatData() {
    loading.value = true
    try {
        data.value = await window.api.eeksekutif.ringkasanMutasiFarmasi(tgl1.value, tgl2.value, props.jenis)
    } catch (err) {
        showToast(err?.message || `Gagal memuat ${props.title}`, 'error')
    } finally {
        loading.value = false
    }
}

const filteredItems = computed(() => {
    if (!data.value) return []
    const q = search.value.toLowerCase()
    return data.value.items.filter(item => [item.kode_brng, item.nama_brng, item.satuan, item.namajenis, item.namagolongan, item.namakategori]
        .some(value => String(value || '').toLowerCase().includes(q)))
})
const paginatedItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const formatRibuan = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value || 0)

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-semibold">{{ title }}</h1>
                <p class="text-sm text-base-content/60">Laporan eksekutif farmasi berdasarkan periode transaksi</p>
            </div>
            <form @submit.prevent="muatData" class="flex flex-wrap items-end gap-3 bg-base-100 p-3 rounded-xl border border-base-200 shadow-sm">
                <label class="form-control">
                    <span class="label py-0.5"><span class="label-text text-xs">Tanggal Awal</span></span>
                    <span class="input input-sm input-bordered flex items-center gap-2"><Calendar class="size-4 text-base-content/50" /><input v-model="tgl1" type="date" required /></span>
                </label>
                <label class="form-control">
                    <span class="label py-0.5"><span class="label-text text-xs">Tanggal Akhir</span></span>
                    <input v-model="tgl2" type="date" class="input input-sm input-bordered" required />
                </label>
                <button type="submit" class="btn btn-primary btn-sm gap-1" :disabled="loading"><RefreshCcw class="size-4" /> Tampilkan</button>
            </form>
        </div>

        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="text-lg font-semibold bg-primary/10 text-primary px-4 py-1 rounded-lg">Total: Rp {{ formatRibuan(data.totalTransaksi) }}</div>
                </div>
                <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredItems.length" :page-sizes="[10, 20, 50, 100]">
                    <div class="overflow-x-auto border border-base-200 rounded-lg">
                        <table class="table table-sm w-full">
                            <thead class="bg-base-200/50 whitespace-nowrap"><tr><th>No</th><th>Kode Barang</th><th>Nama Barang</th><th>Satuan</th><th>Jenis</th><th>Golongan</th><th>Kategori</th><th class="text-right">Jumlah</th><th class="text-right">Total</th></tr></thead>
                            <tbody>
                                <tr v-if="!paginatedItems.length"><td colspan="9" class="py-8 text-center text-base-content/50">Tidak ada data</td></tr>
                                <tr v-for="(item, index) in paginatedItems" :key="item.kode_brng" class="hover"><td>{{ (page - 1) * pageSize + index + 1 }}</td><td>{{ item.kode_brng }}</td><td>{{ item.nama_brng }}</td><td>{{ item.satuan }}</td><td>{{ item.namajenis }}</td><td>{{ item.namagolongan }}</td><td>{{ item.namakategori }}</td><td class="text-right">{{ formatRibuan(item.jumlah) }}</td><td class="text-right font-semibold">{{ formatRibuan(item.total) }}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </AppPagination>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div v-for="chart in data.charts" :key="chart.title" class="space-y-4"><div class="bg-base-100 border border-base-200 rounded-xl shadow-sm p-4 max-h-72 overflow-y-auto"><h2 class="font-medium mb-3">{{ chart.title }}</h2><table class="table table-sm"><tbody><tr v-for="row in chart.data" :key="row.label"><td>{{ row.label }}</td><td class="text-right">{{ formatRibuan(row.value) }}</td></tr></tbody></table></div><EEksekutifPie :title="chart.title" :data="chart.data" /></div>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6"><EEksekutifPie title="10 Besar Jumlah" :data="data.topJumlah" /><EEksekutifPie title="10 Besar Nilai" :data="data.topTotal" /></div>
        </template>
    </div>
</template>