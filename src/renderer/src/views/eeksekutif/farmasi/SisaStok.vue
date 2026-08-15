<script setup>
import { ref, onMounted, computed } from 'vue'
import { RefreshCcw, Search } from 'lucide-vue-next'
import { useToast } from '../../../composables/useToast.js'
import EEksekutifPie from '../../../components/EEksekutifPie.vue'
import AppPagination from '../../../components/AppPagination.vue'

const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)

async function muatData() {
    loading.value = true
    try {
        data.value = await window.api.eeksekutif.sisaStokFarmasi()
    } catch (err) {
        showToast(err?.message || 'Gagal memuat data Sisa Stok Farmasi', 'error')
    } finally {
        loading.value = false
    }
}

const filteredItems = computed(() => {
    if (!data.value) return []
    const q = search.value.toLowerCase()
    return data.value.items.filter(item => 
        item.kode_brng.toLowerCase().includes(q) || 
        item.nama_brng.toLowerCase().includes(q) || 
        item.nama_jenis.toLowerCase().includes(q) || 
        item.nama_kategori.toLowerCase().includes(q) ||
        item.nama_golongan.toLowerCase().includes(q)
    )
})

const paginatedItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filteredItems.value.slice(start, start + pageSize.value)
})

function formatRibuan(angka) {
    return new Intl.NumberFormat('id-ID').format(angka || 0)
}

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-semibold">Sisa Stok & Nilai Aset Farmasi</h1>
                <p class="text-sm text-base-content/60">Laporan eksekutif persediaan farmasi</p>
            </div>
            <button @click="muatData" class="btn btn-primary btn-sm gap-2" :disabled="loading">
                <RefreshCcw class="size-4" :class="loading ? 'animate-spin' : ''" /> Muat Ulang Data
            </button>
        </div>

        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="text-lg font-semibold bg-primary/10 text-primary px-4 py-1 rounded-lg">
                        Total Aset: Rp {{ formatRibuan(data.totalAset) }}
                    </div>
                </div>

                <AppPagination
                    v-model:search="search"
                    v-model:page="page"
                    v-model:page-size="pageSize"
                    :total="filteredItems.length"
                    :page-sizes="[10, 20, 50, 100]"
                >
                    <div class="overflow-x-auto border border-base-200 rounded-lg">
                        <table class="table table-sm w-full">
                            <thead class="bg-base-200/50 whitespace-nowrap">
                                <tr>
                                    <th class="text-center w-12">No</th>
                                    <th>Kode Barang</th>
                                    <th>Nama Barang</th>
                                    <th>Jenis</th>
                                    <th>Kategori</th>
                                    <th>Golongan</th>
                                    <th>Satuan</th>
                                    <th class="text-right">Harga Dasar</th>
                                    <th v-for="b in data.bangsal" :key="b.kd_bangsal" class="text-right">{{ b.nm_bangsal }}</th>
                                    <th class="text-right">Total Stok</th>
                                    <th class="text-right">Nilai Aset</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="!paginatedItems.length"><td :colspan="11 + data.bangsal.length" class="text-center py-8 text-base-content/50">Tidak ada data</td></tr>
                                <tr v-for="(item, idx) in paginatedItems" :key="item.kode_brng" class="hover whitespace-nowrap">
                                    <td class="text-center">{{ (page - 1) * pageSize + idx + 1 }}</td>
                                    <td>{{ item.kode_brng }}</td>
                                    <td>{{ item.nama_brng }}</td>
                                    <td>{{ item.nama_jenis }}</td>
                                    <td>{{ item.nama_kategori }}</td>
                                    <td>{{ item.nama_golongan }}</td>
                                    <td>{{ item.kode_sat }}</td>
                                    <td class="text-right">{{ formatRibuan(item.dasar) }}</td>
                                    <td v-for="b in data.bangsal" :key="b.kd_bangsal" class="text-right">
                                        {{ formatRibuan(item['stok_' + b.kd_bangsal]) }}
                                    </td>
                                    <td class="text-right font-medium">{{ formatRibuan(item.totalBarang) }}</td>
                                    <td class="text-right font-semibold text-primary">{{ formatRibuan(item.nilaiAset) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </AppPagination>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div v-for="chart in data.charts" :key="chart.title" class="space-y-4">
                    <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden">
                        <div class="table-responsive p-4 h-64 overflow-y-auto">
                            <table class="table table-sm w-full">
                                <thead class="bg-base-200/50 sticky top-0">
                                    <tr><th class="w-12 text-center">No</th><th>{{ chart.title.replace('Nilai Aset Per ', '') }}</th><th class="text-right">Nilai Aset</th></tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!chart.data.length"><td colspan="3" class="text-center text-base-content/50 py-4">Kosong</td></tr>
                                    <tr v-for="(row, idx) in chart.data" :key="idx">
                                        <td class="text-center">{{ idx + 1 }}</td>
                                        <td>{{ row.label }}</td>
                                        <td class="text-right">{{ formatRibuan(row.value) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <EEksekutifPie :title="chart.title" :data="chart.data" />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>