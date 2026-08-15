<script setup>
import { onMounted, ref } from 'vue'
import { RefreshCcw } from 'lucide-vue-next'
import EEksekutifPie from '../../components/EEksekutifPie.vue'
import EEksekutifLine from '../../components/EEksekutifLine.vue'
import { useToast } from '../../composables/useToast.js'

const { showToast } = useToast()
const loading = ref(false)
const data = ref(null)

const warna = {
    pink: 'bg-pink-600', cyan: 'bg-cyan-600', lightGreen: 'bg-lime-500', lightBlue: 'bg-sky-500', teal: 'bg-teal-600', orange: 'bg-orange-500', deepOrange: 'bg-orange-700', grey: 'bg-gray-500', deepPurple: 'bg-violet-700', amber: 'bg-amber-500', brown: 'bg-stone-600', blue: 'bg-blue-600', green: 'bg-green-600', red: 'bg-red-600', indigo: 'bg-indigo-600', purple: 'bg-purple-600', blueGrey: 'bg-slate-600'
}

const pendaftaranCards = [
    ['KUNJUNGAN', 'total', 'pink'], ['RAWAT JALAN & IGD', 'ralan', 'cyan'], ['LANJUT RANAP', 'ranap', 'lightGreen'], ['BELUM DILAYANI', 'belumlayani', 'lightBlue'], ['SUDAH DILAYANI', 'sudahlayani', 'teal'], ['BATAL', 'batal', 'orange'], ['DIRUJUK', 'dirujuk', 'deepOrange'], ['PULANG PAKSA', 'pulangpaksa', 'grey'], ['DAFTAR LAMA', 'daftarlama', 'deepPurple'], ['DAFTAR BARU', 'daftarbaru', 'amber'], ['POLI LAMA', 'polilama', 'brown'], ['POLI BARU', 'polibaru', 'blue'], ['SUDAH BAYAR', 'sudahbayar', 'green'], ['BELUM BAYAR', 'belumbayar', 'red'],
]
const ranapCards = [
    ['MASUK RANAP', 'masuk', 'indigo'], ['PINDAH KAMAR', 'pindahkamar', 'purple'], ['PULANG', 'pulang', 'lightGreen'], ['DIRUJUK', 'dirujuk', 'deepOrange'], ['PULANG PAKSA', 'pulangpaksa', 'brown'], ['MENINGGAL', 'meninggal', 'blueGrey'], ['MASIH DIRAWAT', 'masihdirawat', 'teal'], ['TINGKAT OKUPANSI', 'okupansi', 'cyan', '%'],
]

async function muatData() {
    loading.value = true
    try {
        data.value = await window.api.eeksekutif.landing()
    } catch (err) {
        showToast(err?.message || 'Gagal memuat E-Eksekutif', 'error')
    } finally {
        loading.value = false
    }
}

onMounted(muatData)
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-start justify-between">
            <div>
                <h1 class="text-xl font-semibold">E-Eksekutif</h1>
                <p class="text-sm text-base-content/60">Dashboard eksekutif — halaman HomeUser/listhome.php</p>
            </div>
            <button class="btn btn-primary btn-sm gap-2" :disabled="loading" @click="muatData"><RefreshCcw class="size-4" /> Segarkan</button>
        </div>

        <div v-if="loading && !data" class="py-20 text-center"><span class="loading loading-spinner loading-lg text-primary"></span></div>
        <template v-else-if="data">
            <section>
                <h2 class="text-lg font-semibold text-center mb-4">PENDAFTARAN HARI INI</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div v-for="[label, key, color] in pendaftaranCards" :key="key" class="rounded-xl text-white shadow-sm px-5 py-4 hover:scale-[1.01] transition" :class="warna[color]">
                        <div class="text-sm opacity-90">{{ label }}</div>
                        <div class="text-3xl font-bold mt-2">{{ data.pendaftaran[key] || 0 }}</div>
                    </div>
                </div>
            </section>

            <section>
                <h2 class="text-lg font-semibold text-center mb-4">GRAFIK PENDAFTARAN HARI INI</h2>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <EEksekutifPie v-for="chart in data.grafikPendaftaran" :key="chart.title" :title="chart.title" :data="chart.data" />
                </div>
            </section>

            <section>
                <h2 class="text-lg font-semibold text-center mb-4">RAWAT INAP HARI INI</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div v-for="[label, key, color, suffix] in ranapCards" :key="key" class="rounded-xl text-white shadow-sm px-5 py-4 hover:scale-[1.01] transition" :class="warna[color]">
                        <div class="text-sm opacity-90">{{ label }}</div>
                        <div class="text-3xl font-bold mt-2">{{ data.ranap[key] || 0 }}{{ suffix || '' }}</div>
                    </div>
                </div>
            </section>

            <section>
                <h2 class="text-lg font-semibold text-center mb-4">GRAFIK RAWAT INAP HARI INI</h2>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <EEksekutifPie v-for="chart in data.grafikRanap" :key="chart.title" :title="chart.title" :data="chart.data" />
                </div>
            </section>

            <section>
                <h2 class="text-lg font-semibold text-center mb-4">GRAFIK KETERSEDIAAN KAMAR PER BANGSAL</h2>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <EEksekutifPie v-for="chart in data.grafikBangsal" :key="chart.title" :title="chart.title" :data="chart.data" />
                </div>
            </section>

            <section>
                <h2 class="text-lg font-semibold text-center mb-4">GRAFIK KETERSEDIAAN KAMAR PER KELAS</h2>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <EEksekutifPie v-for="chart in data.grafikKelas" :key="chart.title" :title="chart.title" :data="chart.data" />
                </div>
            </section>
        </template>
    </div>
</template>
