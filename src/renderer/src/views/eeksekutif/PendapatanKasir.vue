<script setup>
import { onMounted, ref, watch } from 'vue'
import { Calendar, RefreshCcw } from 'lucide-vue-next'
import EEksekutifPie from '../../components/EEksekutifPie.vue'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'

const props = defineProps({
    title: { type: String, required: true },
    jenis: { type: String, required: true },
})

const authStore = useAuthStore()
const { showToast } = useToast()
const today = new Date().toISOString().slice(0, 10)
const tgl1 = ref(today)
const tgl2 = ref(today)
const loading = ref(false)
const data = ref(null)

const formatRupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(value || 0))

async function muatData() {
    if (tgl1.value > tgl2.value) {
        showToast('Tanggal awal tidak boleh melebihi tanggal akhir', 'error')
        return
    }

    loading.value = true
    try {
        data.value = await window.api.eeksekutif.kasirPendapatan(authStore.token, tgl1.value, tgl2.value, props.jenis)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat data pendapatan kasir', 'error')
    } finally {
        loading.value = false
    }
}

watch(() => props.jenis, () => {
    muatData()
})

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-semibold">{{ title }}</h1>
                <p class="text-sm text-base-content/60">Laporan pendapatan kasir E-Eksekutif</p>
            </div>
            <form class="flex flex-wrap items-end gap-3 bg-base-100 p-3 rounded-xl border border-base-200 shadow-sm" @submit.prevent="muatData">
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
            <div class="stat bg-base-100 border border-base-200 rounded-xl p-4 max-w-sm">
                <div class="stat-title text-xs">Total Pendapatan (Periode Ini)</div>
                <div class="stat-value text-2xl text-primary">{{ formatRupiah(data.grandTotal) }}</div>
            </div>

            <section class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4">
                <h2 class="text-center font-medium mb-3">Rekapitulasi {{ title }}</h2>
                <div class="table-responsive">
                    <table class="table table-sm w-full border">
                        <thead>
                            <tr class="bg-base-200/50">
                                <th>Akun / COA</th>
                                <th v-for="header in data.pivotHeaders" :key="header" class="text-right">{{ header }}</th>
                                <th class="text-right font-bold">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!data.items.length"><td :colspan="data.pivotHeaders.length + 2" class="text-center text-base-content/50 py-6">Tidak ada data transaksi</td></tr>
                            <tr v-for="row in data.items" :key="row.label">
                                <td class="font-medium">{{ row.label }}</td>
                                <td v-for="header in data.pivotHeaders" :key="header" class="text-right">{{ formatRupiah(row[header]) }}</td>
                                <td class="text-right font-bold">{{ formatRupiah(row.total) }}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr class="font-bold bg-base-200/30">
                                <td>Grand Total</td>
                                <td v-for="header in data.pivotHeaders" :key="header" class="text-right">{{ formatRupiah(data.grandPivotTotal[header]) }}</td>
                                <td class="text-right">{{ formatRupiah(data.grandTotal) }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EEksekutifPie v-for="chart in data.charts" :key="chart.title" :title="chart.title" :data="chart.data" />
            </div>
        </template>
    </div>
</template>