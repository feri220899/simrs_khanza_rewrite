<script setup>
import { onMounted, ref, watch } from 'vue'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'

const props = defineProps({ title: String, jenis: String })
const authStore = useAuthStore()
const { showToast } = useToast()
const tahun = ref(String(new Date().getFullYear()))
const loading = ref(false)
const data = ref(null)
const formatRupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(value || 0))

async function muatData() {
    loading.value = true
    try {
        if (props.jenis === 'laporan') data.value = await window.api.eeksekutif.laporanKeuangan(authStore.token, tahun.value)
        else if (props.jenis === 'rekening') data.value = await window.api.eeksekutif.rekeningTahun(authStore.token, tahun.value)
        else data.value = await window.api.eeksekutif.saldoAkunPerBulan(authStore.token, tahun.value)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat laporan akuntansi', 'error')
    } finally {
        loading.value = false
    }
}

function flatten(nodes, depth = 0) {
    return (nodes || []).flatMap(n => [{ ...n, depth }, ...flatten(n.children, depth + 1)])
}

watch(() => props.jenis, muatData)
onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h1 class="text-xl font-semibold">{{ title }}</h1><p class="text-sm text-base-content/60">Laporan akuntansi E-Eksekutif</p></div>
            <form class="flex items-end gap-3 bg-base-100 p-3 rounded-xl border border-base-200 shadow-sm" @submit.prevent="muatData"><label class="form-control"><span class="label py-0.5"><span class="label-text text-xs">Tahun</span></span><input v-model="tahun" class="input input-sm input-bordered" required pattern="\d{4}" /></label><button class="btn btn-primary btn-sm" :disabled="loading">Tampilkan</button></form>
        </div>
        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data && jenis === 'laporan'">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3"><div class="stat bg-base-100 border border-base-200 rounded-xl"><div class="stat-title">Laba Bersih</div><div class="stat-value text-xl">{{ formatRupiah(data.labaBersih) }}</div></div><div class="stat bg-base-100 border border-base-200 rounded-xl"><div class="stat-title">Total Aktiva</div><div class="stat-value text-xl">{{ formatRupiah(data.totalAktiva) }}</div></div><div class="stat bg-base-100 border border-base-200 rounded-xl"><div class="stat-title">Total Pasiva</div><div class="stat-value text-xl">{{ formatRupiah(data.totalPasiva) }}</div></div></div>
            <section v-for="section in [{title:'Pendapatan', rows:data.pendapatan}, {title:'Biaya', rows:data.biaya}, {title:'Modal', rows:data.modal}, {title:'Aktiva', rows:data.aktiva}, {title:'Pasiva', rows:data.pasiva}]" :key="section.title" class="bg-base-100 border border-base-200 rounded-xl p-4"><h2 class="font-semibold mb-2">{{ section.title }}</h2><table class="table table-sm"><tbody><tr v-for="row in flatten(section.rows)" :key="row.kd_rek"><td :style="{ paddingLeft: `${row.depth * 1.5 + 0.75}rem` }">{{ row.kd_rek }} - {{ row.nm_rek }}</td><td class="text-right">{{ formatRupiah(row.saldo_akhir) }}</td></tr></tbody></table></section>
        </template>
        <template v-else-if="data && jenis === 'rekening'">
            <section class="bg-base-100 border border-base-200 rounded-xl p-4 overflow-x-auto"><table class="table table-sm"><thead><tr><th>Kode</th><th>Rekening</th><th class="text-right">Saldo Awal</th><th class="text-right">Debet</th><th class="text-right">Kredit</th><th class="text-right">Saldo Akhir</th></tr></thead><tbody><tr v-for="row in flatten(data.roots)" :key="row.kd_rek"><td>{{ row.kd_rek }}</td><td :style="{ paddingLeft: `${row.depth * 1.5 + 0.75}rem` }">{{ row.nm_rek }}</td><td class="text-right">{{ formatRupiah(row.saldo_awal) }}</td><td class="text-right">{{ formatRupiah(row.mutasi_debet) }}</td><td class="text-right">{{ formatRupiah(row.mutasi_kredit) }}</td><td class="text-right font-semibold">{{ formatRupiah(row.saldo_akhir) }}</td></tr></tbody></table></section>
        </template>
        <template v-else-if="data">
            <section class="bg-base-100 border border-base-200 rounded-xl p-4 overflow-x-auto"><table class="table table-sm"><thead><tr><th>Kode</th><th>Rekening</th><th v-for="b in data.bulan" :key="b" class="text-right">{{ b }}</th><th class="text-right">Akhir</th></tr></thead><tbody><tr v-for="row in data.items" :key="row.kd_rek"><td>{{ row.kd_rek }}</td><td>{{ row.nm_rek }}</td><td v-for="b in data.bulan" :key="b" class="text-right">{{ formatRupiah(row.bulan[b].saldo) }}</td><td class="text-right font-semibold">{{ formatRupiah(row.saldo_akhir) }}</td></tr></tbody></table></section>
        </template>
    </div>
</template>