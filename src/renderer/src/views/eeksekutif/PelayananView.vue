<script setup>
import { ref, onMounted } from 'vue'
import { Calendar, RefreshCcw } from 'lucide-vue-next'
import EEksekutifPie from '../../components/EEksekutifPie.vue'
import EEksekutifLine from '../../components/EEksekutifLine.vue'
import { useToast } from '../../composables/useToast.js'

const props = defineProps({
    title: { type: String, required: true },
    type: { type: String, required: true },
})

const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)
const activeTab = ref('masuk')

const todayStr = new Date().toISOString().slice(0, 10)
const tgl1 = ref(todayStr)
const tgl2 = ref(todayStr)

async function muatData() {
    loading.value = true
    try {
        if (props.type === 'rawatJalan') data.value = await window.api.eeksekutif.rawatJalan(tgl1.value, tgl2.value)
        else if (props.type === 'igd') data.value = await window.api.eeksekutif.igd(tgl1.value, tgl2.value)
        else if (props.type === 'rawatInap') data.value = await window.api.eeksekutif.rawatInap(tgl1.value, tgl2.value)
        else if (props.type === 'lab') data.value = await window.api.eeksekutif.lab(tgl1.value, tgl2.value)
        else if (props.type === 'radiologi') data.value = await window.api.eeksekutif.radiologi(tgl1.value, tgl2.value)
    } catch (err) {
        showToast(err?.message || 'Gagal memuat data pelayanan', 'error')
    } finally {
        loading.value = false
    }
}

function calcTotal(items) {
    return (items || []).reduce((sum, row) => sum + (row.isHeader ? Number(row.jumlah || 0) : 0), 0)
}

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-semibold">{{ title }}</h1>
                <p class="text-sm text-base-content/60">Laporan eksekutif {{ title.toLowerCase() }}</p>
            </div>
            <form @submit.prevent="muatData" class="flex flex-wrap items-center gap-2 bg-base-100 p-2 rounded-xl border border-base-200 shadow-sm">
                <div class="flex items-center gap-2 text-sm">
                    <Calendar class="size-4 text-base-content/50" />
                    <input type="date" v-model="tgl1" class="input input-xs input-bordered" required />
                    <span>s/d</span>
                    <input type="date" v-model="tgl2" class="input input-xs input-bordered" required />
                </div>
                <button type="submit" class="btn btn-primary btn-xs gap-1" :disabled="loading">
                    <RefreshCcw class="size-3" /> Tampilkan Data & Grafik
                </button>
            </form>
        </div>

        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <div v-if="type === 'rawatInap'" class="tabs tabs-boxed max-w-md bg-base-200">
                <a class="tab" :class="{ 'tab-active': activeTab === 'masuk' }" @click="activeTab = 'masuk'">BERDASARKAN TANGGAL MASUK</a>
                <a class="tab" :class="{ 'tab-active': activeTab === 'pulang' }" @click="activeTab = 'pulang'">BERDASARKAN TANGGAL PULANG</a>
            </div>

            <div v-if="type === 'rawatInap'" class="space-y-8">
                <div v-for="chart in data[activeTab]" :key="chart.title" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden">
                        <div class="table-responsive p-4">
                            <table class="table table-sm w-full">
                                <thead>
                                    <tr><th class="w-12 text-center">No</th><th>Item</th><th class="w-24 text-center">Jumlah</th></tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!chart.data.length"><td colspan="3" class="text-center text-base-content/50 py-4">Kosong</td></tr>
                                    <tr v-for="(row, idx) in chart.data" :key="idx">
                                        <td class="text-center">{{ idx + 1 }}</td>
                                        <td>{{ row.label.split(' (')[0] }}</td>
                                        <td class="text-center">{{ row.value }}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr class="font-bold">
                                        <td colspan="2" class="text-right">Total</td>
                                        <td class="text-center">{{ chart.data.reduce((s, r) => s + r.value, 0) }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    <div>
                        <EEksekutifPie v-if="chart.type === 'pie'" :title="chart.title" :data="chart.data" />
                        <EEksekutifLine v-else :title="chart.title" :data="chart.data" :color="chart.title.includes('Bulan') ? '#3f51b5' : '#e91e63'" />
                    </div>
                </div>
            </div>

            <div v-else class="space-y-8">
                <template v-if="data.charts">
                    <div v-for="chart in data.charts" :key="chart.title" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden">
                            <div class="table-responsive p-4">
                                <table class="table table-sm w-full">
                                    <thead>
                                        <tr><th class="w-12 text-center">No</th><th>Item</th><th class="w-24 text-center">Jumlah</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr v-if="!chart.data.length"><td colspan="3" class="text-center text-base-content/50 py-4">Kosong</td></tr>
                                        <tr v-for="(row, idx) in chart.data" :key="idx">
                                            <td class="text-center">{{ idx + 1 }}</td>
                                            <td>{{ row.label.split(' (')[0] }}</td>
                                            <td class="text-center">{{ row.value }}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr class="font-bold">
                                            <td colspan="2" class="text-right">Total</td>
                                            <td class="text-center">{{ chart.data.reduce((s, r) => s + r.value, 0) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        <div>
                            <EEksekutifPie v-if="chart.type === 'pie'" :title="chart.title" :data="chart.data" />
                            <EEksekutifLine v-else :title="chart.title" :data="chart.data" :color="chart.title.includes('Bulan') ? '#3f51b5' : '#e91e63'" />
                        </div>
                    </div>
                </template>

                <template v-if="data.tables">
                    <div v-for="tbl in data.tables" :key="tbl.title" class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden p-4">
                        <h2 class="text-center font-medium text-base-content/80 mb-3">{{ tbl.title }}</h2>
                        <div class="table-responsive">
                            <table class="table table-sm w-full border">
                                <thead>
                                    <tr>
                                        <th class="w-12 text-center">No</th>
                                        <th>{{ tbl.headers[0] }}</th>
                                        <th class="w-24 text-center">{{ tbl.headers[1] }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!tbl.data.length"><td colspan="3" class="text-center text-base-content/50 py-4">Kosong</td></tr>
                                    <template v-for="(row, idx) in tbl.data" :key="idx">
                                        <tr v-if="row.isHeader" class="font-bold bg-base-200/50">
                                            <td class="text-center">{{ idx + 1 }}</td>
                                            <td>{{ row.label }}</td>
                                            <td class="text-center">{{ row.jumlah }}</td>
                                        </tr>
                                        <tr v-else>
                                            <td></td>
                                            <td class="pl-6">{{ row.label }}</td>
                                            <td class="text-center">{{ row.jumlah }}</td>
                                        </tr>
                                    </template>
                                </tbody>
                                <tfoot>
                                    <tr class="font-bold">
                                        <td colspan="2" class="text-right">Total / Jumlah</td>
                                        <td class="text-center">{{ calcTotal(tbl.data) }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </template>

                <div v-if="data.statusChart" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden">
                        <div class="table-responsive p-4">
                            <table class="table table-sm w-full">
                                <thead>
                                    <tr><th class="w-12 text-center">No</th><th>Status</th><th class="w-24 text-center">Jumlah</th></tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!data.statusChart.data.length"><td colspan="3" class="text-center text-base-content/50 py-4">Kosong</td></tr>
                                    <tr v-for="(row, idx) in data.statusChart.data" :key="idx">
                                        <td class="text-center">{{ idx + 1 }}</td>
                                        <td>{{ row.label.split(' (')[0] }}</td>
                                        <td class="text-center">{{ row.value }}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr class="font-bold">
                                        <td colspan="2" class="text-right">Jumlah</td>
                                        <td class="text-center">{{ data.statusChart.data.reduce((s, r) => s + r.value, 0) }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    <div>
                        <EEksekutifPie :title="data.statusChart.title" :data="data.statusChart.data" />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
