<script setup>
import { computed, onMounted, ref } from 'vue'
import { RefreshCcw, Search } from 'lucide-vue-next'
import { useToast } from '../../../composables/useToast.js'
import AppPagination from '../../../components/AppPagination.vue'
import EEksekutifPie from '../../../components/EEksekutifPie.vue'

const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(20)

async function muatData() {
    loading.value = true
    try {
        data.value = await window.api.eeksekutif.sisaStokDapur()
    } catch (err) {
        showToast(err?.message || 'Gagal memuat sisa stok dapur', 'error')
    } finally {
        loading.value = false
    }
}

const filteredItems = computed(() => {
    if (!data.value) return []
    const q = search.value.toLowerCase()
    return data.value.items.filter(item => [item.kode_brng, item.nama_brng, item.jenis].some(v => String(v || '').toLowerCase().includes(q)))
})
const paginatedItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const formatRibuan = v => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v || 0)

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h1 class="text-xl font-semibold">Sisa Stok & Nilai Aset Dapur</h1><p class="text-sm text-base-content/60">Laporan inventori barang dapur/gizi</p></div>
            <button @click="muatData" class="btn btn-primary btn-sm gap-2" :disabled="loading"><RefreshCcw class="size-4" /> Muat Ulang</button>
        </div>
        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4"><div class="text-lg font-semibold bg-primary/10 text-primary px-4 py-1 rounded-lg">Total Aset: Rp {{ formatRibuan(data.totalAset) }}</div></div>
                <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredItems.length" :page-sizes="[10, 20, 50, 100]">
                    <div class="overflow-x-auto border border-base-200 rounded-lg"><table class="table table-sm w-full"><thead class="bg-base-200/50 whitespace-nowrap"><tr><th>No</th><th>Kode Barang</th><th>Nama Barang</th><th>Jenis</th><th>Satuan</th><th class="text-right">Stok</th><th class="text-right">Harga Dasar</th><th class="text-right">Nilai Aset</th></tr></thead><tbody><tr v-if="!paginatedItems.length"><td colspan="8" class="text-center py-8 text-base-content/50">Tidak ada data</td></tr><tr v-for="(item, idx) in paginatedItems" :key="item.kode_brng" class="hover whitespace-nowrap"><td class="text-center">{{ (page - 1) * pageSize + idx + 1 }}</td><td>{{ item.kode_brng }}</td><td>{{ item.nama_brng }}</td><td>{{ item.jenis }}</td><td>{{ item.kode_sat }}</td><td class="text-right">{{ formatRibuan(item.stok) }}</td><td class="text-right">{{ formatRibuan(item.harga) }}</td><td class="text-right font-semibold text-primary">{{ formatRibuan(item.nilaiAset) }}</td></tr></tbody></table></div>
                </AppPagination>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div v-for="chart in data.charts" :key="chart.title" class="space-y-4"><EEksekutifPie :title="chart.title" :data="chart.data" /></div></div>
        </template>
    </div>
</template>