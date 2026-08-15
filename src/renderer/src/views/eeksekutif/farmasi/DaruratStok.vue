<script setup>
import { ref, onMounted, computed } from 'vue'
import { RefreshCcw, Search } from 'lucide-vue-next'
import { useToast } from '../../../composables/useToast.js'
import AppPagination from '../../../components/AppPagination.vue'

const { showToast } = useToast()
const loading = ref(false)
const items = ref([])
const search = ref('')
const page = ref(1)
const pageSize = ref(20)

async function muatData() {
    loading.value = true
    try {
        items.value = await window.api.eeksekutif.daruratStokFarmasi()
    } catch (err) {
        showToast(err?.message || 'Gagal memuat data Darurat Stok Farmasi', 'error')
    } finally {
        loading.value = false
    }
}

const filteredItems = computed(() => {
    const q = search.value.toLowerCase()
    return items.value.filter(item => 
        item.kode_brng.toLowerCase().includes(q) || 
        item.nama_brng.toLowerCase().includes(q) || 
        item.nama_jenis.toLowerCase().includes(q)
    )
})

const paginatedItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filteredItems.value.slice(start, start + pageSize.value)
})

function formatRibuan(angka) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(angka || 0)
}

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-semibold">Defecta / Darurat Stok Farmasi</h1>
                <p class="text-sm text-base-content/60">Data barang dengan stok di bawah batas minimal</p>
            </div>
            <button @click="muatData" class="btn btn-primary btn-sm gap-2" :disabled="loading">
                <RefreshCcw class="size-4" :class="loading ? 'animate-spin' : ''" /> Muat Ulang Data
            </button>
        </div>

        <div v-if="loading && !items.length" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <div v-else class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4"></div>

            <AppPagination
                v-model:search="search"
                v-model:page="page"
                v-model:page-size="pageSize"
                :total="filteredItems.length"
                :page-sizes="[10, 20, 50, 100]"
            >
                <div class="overflow-x-auto border border-base-200 rounded-lg">
                    <table class="table table-sm w-full">
                        <thead class="bg-base-200/50">
                            <tr>
                                <th class="text-center w-12">No</th>
                                <th>Kode Barang</th>
                                <th>Nama Barang</th>
                                <th>Satuan</th>
                                <th>Jenis</th>
                                <th class="text-right">Stok Minimal</th>
                                <th class="text-right">Stok Saat Ini</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!paginatedItems.length"><td colspan="7" class="text-center py-8 text-base-content/50">Tidak ada barang darurat stok</td></tr>
                            <tr v-for="(item, idx) in paginatedItems" :key="item.kode_brng" class="hover">
                                <td class="text-center">{{ (page - 1) * pageSize + idx + 1 }}</td>
                                <td class="whitespace-nowrap">{{ item.kode_brng }}</td>
                                <td>{{ item.nama_brng }}</td>
                                <td>{{ item.satuan }}</td>
                                <td>{{ item.nama_jenis }}</td>
                                <td class="text-right font-medium text-warning">{{ formatRibuan(item.stokminimal) }}</td>
                                <td class="text-right font-bold text-error">{{ formatRibuan(item.stoksaatini) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AppPagination>
        </div>
    </div>
</template>