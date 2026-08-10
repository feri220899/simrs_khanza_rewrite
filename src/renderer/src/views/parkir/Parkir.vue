<script setup>
import { ref, onMounted } from 'vue'

// Contoh halaman Fase 1 yang benar-benar hit Postgres lewat IPC
// (window.api.parkir.*) — bukan Express. Lihat src/main/db/modules/ParkirService.js
// dan preload.js. Cuma nampilin master jenis parkir dulu (kd_parkir, jns_parkir,
// biaya) — CRUD lengkap & cek barcode belum diimplementasikan, ikuti SOP.
const jenisList = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
    try {
        jenisList.value = await window.api.parkir.listJenis()
    } catch (err) {
        error.value = 'Gagal mengambil data dari database: ' + err.message
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div>
        <h1 class="text-xl font-bold mb-1">Parkir — Jenis & Tarif</h1>
        <p class="text-sm text-base-content/60 mb-4">
            Contoh modul Fase 1 pertama — data diambil langsung dari Postgres (tabel <code>parkir_jenis</code>).
        </p>

        <p v-if="loading" class="text-sm text-base-content/50">Memuat...</p>
        <p v-else-if="error" class="text-error text-sm">{{ error }}</p>
        <p v-else-if="jenisList.length === 0" class="text-sm text-base-content/50">
            Belum ada data. Tambahkan lewat SQL langsung dulu (form input belum dibuat).
        </p>

        <table v-else class="table">
            <thead>
                <tr><th>Kode</th><th>Jenis</th><th>Tarif</th></tr>
            </thead>
            <tbody>
                <tr v-for="j in jenisList" :key="j.kd_parkir">
                    <td>{{ j.kd_parkir }}</td>
                    <td>{{ j.jns_parkir }}</td>
                    <td>{{ Number(j.biaya).toLocaleString('id-ID') }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
