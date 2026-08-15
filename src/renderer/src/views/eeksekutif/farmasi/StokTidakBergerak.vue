<script setup>
import { computed, onMounted, ref } from 'vue'
import { Calendar, RefreshCcw, Search } from 'lucide-vue-next'
import EEksekutifPie from '../../../components/EEksekutifPie.vue'
import AppPagination from '../../../components/AppPagination.vue'
import { useToast } from '../../../composables/useToast.js'

const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(20)
const periode = ref('1')

async function muatData() {
    loading.value = true
    try {
        data.value = await window.api.eeksekutif.stokTidakBergerak(periode.value)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat dead stok', 'error')
    } finally {
        loading.value = false
    }
}

const filteredItems = computed(() => {
    if (!data.value) return []
    const q = search.value.toLowerCase()
    return data.value.items.filter(item => [item.kode_brng, item.nama_brng, item.namajenis, item.namagolongan, item.namakategori].some(v => String(v || '').toLowerCase().includes(q)))
})
const paginatedItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const formatRibuan = v => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v || 0)

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h1 class="text-xl font-semibold">Stok Tidak Bergerak (Dead Stok)</h1><p class="text-sm text-base-content/60">Tidak ada riwayat mutasi keluar dalam X bulan terakhir</p></div>
            <form @submit.prevent="muatData" class="flex flex-wrap items-end gap-3 bg-base-100 p-3 rounded-xl border border-base-200 shadow-sm">
                <label class="form-control">
                    <span class="label py-0.5"><span class="label-text text-xs">Periode Tidak Mutasi</span></span>
                    <select v-model="periode" class="select select-sm select-bordered">
                        <option value="1">1 Bulan Terakhir</option>
                        <option value="3">3 Bulan Terakhir</option>
                        <option value="6">6 Bulan Terakhir</option>
                        <option value="9">9 Bulan Terakhir</option>
                        <option value="12">12 Bulan Terakhir</option>
                    </select>
                </label>
                <button type="submit" class="btn btn-primary btn-sm gap-1" :disabled="loading"><RefreshCcw class="size-4" /> Tampilkan</button>
            </form>
        </div>
        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4"><div class="text-lg font-semibold bg-primary/10 text-primary px-4 py-1 rounded-lg">Total Nilai Dead Stok: Rp {{ formatRibuan(data.totalAset) }}</div></div>
                <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredItems.length" :page-sizes="[10, 20, 50, 100]">
                    <div class="overflow-x-auto border border-base-200 rounded-lg"><table class="table table-sm w-full"><thead class="bg-base-200/50 whitespace-nowrap"><tr><th>No</th><th>Kode Barang</th><th>Nama Barang</th><th>Satuan</th><th>Jenis</th><th>Kategori</th><th>Golongan</th><th class="text-right">Sisa Stok</th><th class="text-right">Harga Dasar</th><th class="text-right">Nilai Aset</th></tr></thead><tbody><tr v-if="!paginatedItems.length"><td colspan="10" class="text-center py-8 text-base-content/50">Tidak ada data dead stok untuk periode ini</td></tr><tr v-for="(item, idx) in paginatedItems" :key="item.kode_brng"><td>{{ (page - 1) * pageSize + idx + 1 }}</td><td>{{ item.kode_brng }}</td><td>{{ item.nama_brng }}</td><td>{{ item.satuan }}</td><td>{{ item.namajenis }}</td><td>{{ item.namakategori }}</td><td>{{ item.namagolongan }}</td><td class="text-right">{{ formatRibuan(item.stoksaatini) }}</td><td class="text-right">{{ formatRibuan(item.dasar) }}</td><td class="text-right font-semibold">{{ formatRibuan(item.aset) }}</td></tr></tbody></table></div>
                </AppPagination>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div v-for="chart in data.charts" :key="chart.title" class="space-y-4"><EEksekutifPie :title="chart.title" :data="chart.data" /></div></div>
        </template>
    </div>
</template>