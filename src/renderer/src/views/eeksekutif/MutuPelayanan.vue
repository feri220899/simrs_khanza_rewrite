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

const formatAngka = value => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))

async function muatData() {
    if (tgl1.value > tgl2.value) {
        showToast('Tanggal awal tidak boleh melebihi tanggal akhir', 'error')
        return
    }

    loading.value = true
    try {
        data.value = await window.api.eeksekutif.mutuLamaPelayanan(authStore.token, tgl1.value, tgl2.value, props.jenis)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat data kendali mutu', 'error')
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
                <p class="text-sm text-base-content/60">Kendali mutu E-Eksekutif</p>
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
            <template v-if="data.type === 'single'">
                <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div class="stat bg-base-100 border border-base-200 rounded-xl p-4"><div class="stat-title text-xs">Rata-rata</div><div class="stat-value text-xl">{{ formatAngka(data.global.rata) }}</div><div class="stat-desc">Menit</div></div>
                    <div class="stat bg-base-100 border border-base-200 rounded-xl p-4"><div class="stat-title text-xs">Jumlah</div><div class="stat-value text-xl">{{ data.global.jumlah }}</div><div class="stat-desc">Kunjungan</div></div>
                    <div class="stat bg-base-100 border border-base-200 rounded-xl p-4"><div class="stat-title text-xs">0–15 Menit</div><div class="stat-value text-xl">{{ data.global.limabelas }}</div></div>
                    <div class="stat bg-base-100 border border-base-200 rounded-xl p-4"><div class="stat-title text-xs">&gt;15–30 Menit</div><div class="stat-value text-xl">{{ data.global.tigapuluh }}</div></div>
                    <div class="stat bg-base-100 border border-base-200 rounded-xl p-4"><div class="stat-title text-xs">&gt;30–60 Menit</div><div class="stat-value text-xl">{{ data.global.satujam }}</div></div>
                    <div class="stat bg-base-100 border border-base-200 rounded-xl p-4"><div class="stat-title text-xs">&gt;60 Menit</div><div class="stat-value text-xl">{{ data.global.lebihsatujam }}</div></div>
                </div>

                <EEksekutifPie title="Distribusi Lama Pelayanan" :data="data.chart" />

                <section v-for="table in [{ title: 'Rekap Per Dokter', label: 'Nama Dokter', rows: data.dokter }, { title: 'Rekap Per Poli', label: 'Nama Poli', rows: data.poli }]" :key="table.title" class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h2 class="text-center font-medium mb-3">{{ table.title }}</h2>
                    <div class="table-responsive">
                        <table class="table table-sm w-full">
                            <thead><tr><th class="text-center">No</th><th>{{ table.label }}</th><th class="text-center">Rata-rata</th><th class="text-center">0–15</th><th class="text-center">&gt;15–30</th><th class="text-center">&gt;30–60</th><th class="text-center">&gt;60</th></tr></thead>
                            <tbody>
                                <tr v-if="!table.rows.length"><td colspan="7" class="text-center text-base-content/50 py-6">Tidak ada data</td></tr>
                                <tr v-for="(row, index) in table.rows" :key="row.label"><td class="text-center">{{ index + 1 }}</td><td>{{ row.label }}</td><td class="text-center">{{ formatAngka(row.rata) }}</td><td class="text-center">{{ row.limabelas }}</td><td class="text-center">{{ row.tigapuluh }}</td><td class="text-center">{{ row.satujam }}</td><td class="text-center">{{ row.lebihsatujam }}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </template>
            <template v-else-if="data.type === 'intervalApotek' || data.type === 'intervalLab'">
                <section class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h2 class="text-center font-medium mb-3">Rekap Interval Mutu Pelayanan</h2>
                    <div class="table-responsive">
                        <table class="table table-sm w-full border">
                            <thead>
                                <tr class="bg-base-200/50">
                                    <th>Mutu Layanan</th>
                                    <th class="text-center">Rata-rata (Menit)</th>
                                    <th class="text-center">0–15</th>
                                    <th class="text-center">&gt;15–30</th>
                                    <th class="text-center">&gt;30–60</th>
                                    <th v-if="data.type === 'intervalLab'" class="text-center">&gt;60–120</th>
                                    <th class="text-center">{{ data.type === 'intervalLab' ? '&gt;120' : '&gt;60' }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="!data.rekap.length"><td :colspan="data.type === 'intervalLab' ? 7 : 6" class="text-center text-base-content/50 py-6">Tidak ada data</td></tr>
                                <tr v-for="row in data.rekap" :key="row.label">
                                    <td class="font-medium">{{ row.label }}</td>
                                    <td class="text-center">{{ formatAngka(row.rata) }}</td>
                                    <td class="text-center">{{ row.limabelas }}</td>
                                    <td class="text-center">{{ row.tigapuluh }}</td>
                                    <td class="text-center">{{ row.satujam }}</td>
                                    <td v-if="data.type === 'intervalLab'" class="text-center">{{ row.duajam }}</td>
                                    <td class="text-center">{{ data.type === 'intervalLab' ? row.lebihduajam : row.lebihsatujam }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <EEksekutifPie v-for="row in data.rekap" :key="row.label" :title="row.label" :data="data.type === 'intervalLab' ? [
                        { label: '0 - 15 Menit', value: row.limabelas },
                        { label: '>15 - <=30 Menit', value: row.tigapuluh },
                        { label: '>30 - <=60 Menit', value: row.satujam },
                        { label: '>60 - <=120 Menit', value: row.duajam },
                        { label: '>120 Menit', value: row.lebihduajam }
                    ] : [
                        { label: '0 - 15 Menit', value: row.limabelas },
                        { label: '>15 - <=30 Menit', value: row.tigapuluh },
                        { label: '>30 - <=60 Menit', value: row.satujam },
                        { label: '>60 Menit', value: row.lebihsatujam }
                    ]" />
                </div>
            </template>
        </template>
    </div>
</template>
