<script setup>
import { computed, onMounted, ref } from 'vue'
import { Calendar, RefreshCcw } from 'lucide-vue-next'
import { useToast } from '../../../composables/useToast.js'
import AppPagination from '../../../components/AppPagination.vue'
import EEksekutifPie from '../../../components/EEksekutifPie.vue'

const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(20)
const tahun = ref(String(new Date().getFullYear()))

async function muatData() {
    loading.value = true
    try {
        data.value = await window.api.eeksekutif.penerimaanVendorNonMedisPerBulan(tahun.value)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat penerimaan vendor per bulan', 'error')
    } finally {
        loading.value = false
    }
}

const filteredItems = computed(() => {
    if (!data.value) return []
    const q = search.value.toLowerCase()
    return data.value.items.filter(item => item.nama_suplier.toLowerCase().includes(q))
})
const paginatedItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const formatRibuan = v => new Intl.NumberFormat('id-ID').format(v || 0)

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h1 class="text-xl font-semibold">Nilai Penerimaan Vendor Non Medis (IPSRS)</h1></div>
            <form @submit.prevent="muatData" class="flex flex-wrap items-end gap-3 bg-base-100 p-3 rounded-xl border border-base-200 shadow-sm"><label class="form-control"><span class="label py-0.5"><span class="label-text text-xs">Tahun</span></span><span class="input input-sm input-bordered flex items-center gap-2"><Calendar class="size-4 text-base-content/50" /><input v-model="tahun" type="number" class="w-24" required /></span></label><button type="submit" class="btn btn-primary btn-sm gap-1" :disabled="loading"><RefreshCcw class="size-4" /> Tampilkan</button></form>
        </div>
        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4"><div class="text-lg font-semibold bg-primary/10 text-primary px-4 py-1 rounded-lg">Total: Rp {{ formatRibuan(data.totalAll) }}</div></div>
                <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredItems.length" :page-sizes="[10, 20, 50, 100]">
                    <div class="overflow-x-auto border border-base-200 rounded-lg"><table class="table table-sm w-full"><thead class="bg-base-200/50 whitespace-nowrap"><tr><th>No</th><th>Vendor</th><th v-for="i in 12" :key="i" class="text-right">{{ i }}</th><th class="text-right">Total</th></tr></thead><tbody><tr v-if="!paginatedItems.length"><td colspan="14" class="text-center py-8 text-base-content/50">Tidak ada data</td></tr><tr v-for="(item, idx) in paginatedItems" :key="item.nama_suplier"><td>{{ (page - 1) * pageSize + idx + 1 }}</td><td>{{ item.nama_suplier }}</td><td v-for="(b, bi) in item.bulan" :key="bi" class="text-right">{{ formatRibuan(b) }}</td><td class="text-right font-semibold">{{ formatRibuan(item.total) }}</td></tr></tbody></table></div>
                </AppPagination>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6"><EEksekutifPie title="Vendor Terbesar" :data="data.chartVendor" /><EEksekutifPie title="Tren Penerimaan per Bulan" :data="data.chartBulan" /></div>
        </template>
    </div>
</template>