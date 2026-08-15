<script setup>
import { onMounted, ref, watch } from 'vue'
import EEksekutifPie from '../../components/EEksekutifPie.vue'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'

const props = defineProps({ title: String, mode: String, jenis: String })
const authStore = useAuthStore()
const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const formatRupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(value || 0))

async function muatData() {
    loading.value = true
    try {
        data.value = props.mode === 'hutang'
            ? await window.api.eeksekutif.akuntansiHutang(authStore.token, props.jenis)
            : await window.api.eeksekutif.akuntansiPiutang(authStore.token, props.jenis)
    } catch (err) {
        showToast(err?.message || `Gagal memuat ${props.title.toLowerCase()}`, 'error')
    } finally {
        loading.value = false
    }
}

watch(() => props.jenis, muatData)
onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div><h1 class="text-xl font-semibold">{{ title }}</h1><p class="text-sm text-base-content/60">Laporan E-Eksekutif</p></div>
        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div class="stat bg-base-100 border border-base-200 rounded-xl p-4 max-w-sm"><div class="stat-title">Total</div><div class="stat-value text-2xl text-primary">{{ formatRupiah(data.grandTotal) }}</div></div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <div class="overflow-x-auto"><table class="table table-sm w-full"><thead><tr><th>{{ mode === 'hutang' ? 'Suplier / Pemberi Hutang' : jenis === 'obat' ? 'Pasien' : 'Cara Bayar' }}</th><th class="text-right">Sisa</th></tr></thead><tbody><tr v-if="!data.items.length"><td colspan="2" class="py-6 text-center text-base-content/50">Tidak ada data</td></tr><tr v-for="item in data.items" :key="item.id"><td>{{ item.nama }}</td><td class="text-right font-medium">{{ formatRupiah(item.sisa) }}</td></tr></tbody><tfoot><tr class="font-bold"><td>Total</td><td class="text-right">{{ formatRupiah(data.grandTotal) }}</td></tr></tfoot></table></div>
                </section>
                <EEksekutifPie v-for="chart in data.charts" :key="chart.title" :title="chart.title" :data="chart.data" />
            </div>
        </template>
    </div>
</template>