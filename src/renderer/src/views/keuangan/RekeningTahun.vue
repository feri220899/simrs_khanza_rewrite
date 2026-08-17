<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Save, RotateCcw, Search, FolderOpen } from 'lucide-vue-next'
import AppPagination from '../../components/AppPagination.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'

const authStore = useAuthStore()
const { showToast } = useToast()

const tahun = ref(new Date().getFullYear())
const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')

// Pagination
const page = ref(1)
const pageSize = ref(20)

const filteredRows = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return rows.value
    return rows.value.filter(row => `${row.kd_rek} ${row.nm_rek}`.toLowerCase().includes(q))
})

const paginatedRows = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filteredRows.value.slice(start, start + pageSize.value)
})

const total = computed(() => rows.value.reduce((sum, row) => sum + Number(row.saldo_awal || 0), 0))

async function load() {
    loading.value = true
    try {
        rows.value = await window.api.keuangan.rekeningTahun.list(Number(tahun.value))
    } catch (err) {
        showToast(err?.message || 'Gagal memuat saldo awal', 'error')
    } finally {
        loading.value = false
    }
}

async function save() {
    saving.value = true
    try {
        const payload = rows.value.map(row => ({
            kd_rek: String(row.kd_rek || ''),
            saldo_awal: Number(row.saldo_awal || 0)
        }))
        const result = await window.api.keuangan.rekeningTahun.save(authStore.token, Number(tahun.value), payload)
        if (!result.success) return showToast(result.message || 'Gagal menyimpan saldo awal', 'error')
        showToast('Saldo awal berhasil disimpan')
        await load()
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan saldo awal', 'error')
    } finally {
        saving.value = false
    }
}

function format(value) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value || 0))
}

watch(tahun, load)
onMounted(load)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
            <div>
                <h1 class="text-xl font-bold flex items-center gap-2">
                    <FolderOpen class="size-6 text-primary" /> Saldo Awal Rekening
                </h1>
                <p class="text-sm text-base-content/60">Pengaturan saldo awal COA per tahun anggaran</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm gap-2" :disabled="loading || saving" @click="load">
                    <RotateCcw class="size-4" /> Refresh
                </button>
                <button class="btn btn-primary btn-sm gap-2" :disabled="loading || saving" @click="save">
                    <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                    <Save v-else class="size-4" /> Simpan Semua Saldo
                </button>
            </div>
        </div>

        <!-- Filter / Search bar -->
        <div class="bg-base-100 border border-base-200 rounded-2xl p-3 mb-4 shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div class="flex items-center gap-3">
                <label class="form-control">
                    <span class="label-text text-[10px] font-semibold uppercase tracking-wider mb-1 mr-2">Tahun Anggaran</span>
                    <input v-model.number="tahun" type="number" min="1900" max="2200" class="input input-sm input-bordered font-mono font-bold w-32" />
                </label>
                
                <div class="form-control flex-1 w-64 max-w-sm relative self-end">
                    <Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input
                        v-model="search"
                        type="text"
                        placeholder="Cari kode atau nama rekening..."
                        class="input input-sm input-bordered pl-9 w-full"
                    />
                </div>
            </div>

            <div class="text-xs font-semibold px-4 py-2 bg-primary/10 text-primary rounded-lg shadow-sm border border-primary/20">
                TOTAL SALDO AWAL: {{ format(total) }}
            </div>
        </div>

        <!-- Search, Pagination & Table -->
        <AppPagination v-model:search="search" v-model:page="page" v-model:page-size="pageSize" :total="filteredRows.length" :page-sizes="[10, 20, 50, 100]">
            <div class="overflow-x-auto border border-base-200 rounded-lg relative min-h-[300px] max-h-[70vh] overflow-y-auto">
                <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-base-100/80 z-50">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                    <p class="mt-2 text-sm text-base-content/60">Memuat saldo awal...</p>
                </div>
                
                <table class="table table-sm w-full table-fixed">
                    <thead class="sticky top-0 z-30 bg-base-200 text-base-content font-semibold shadow-sm">
                        <tr>
                            <th class="w-28 bg-base-200">Kode</th>
                            <th class="bg-base-200">Nama Rekening</th>
                            <th class="w-40 bg-base-200">Tipe</th>
                            <th class="w-32 bg-base-200">Balance</th>
                            <th class="w-48 text-right bg-base-200">Nominal Saldo Awal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in paginatedRows" :key="row.kd_rek" class="hover group">
                            <td class="font-mono font-semibold text-primary truncate">{{ row.kd_rek }}</td>
                            <td class="truncate">{{ row.nm_rek }}</td>
                            <td>
                                <span class="badge badge-sm badge-outline font-medium" 
                                      :class="{
                                          'badge-info': row.tipe === 'N', 
                                          'badge-warning': row.tipe === 'R',
                                          'badge-secondary': row.tipe === 'M'
                                      }">
                                    {{ row.tipe === 'N' ? 'Neraca (N)' : row.tipe === 'R' ? 'Rugi Laba (R)' : row.tipe === 'M' ? 'Modal (M)' : '-' }}
                                </span>
                            </td>
                            <td>
                                <span class="badge badge-sm font-semibold" 
                                      :class="{
                                          'badge-success badge-soft': row.balance === 'D', 
                                          'badge-error badge-soft': row.balance === 'K',
                                          'badge-ghost': !row.balance
                                      }">
                                    {{ row.balance === 'D' ? 'Debet (D)' : row.balance === 'K' ? 'Kredit (K)' : '-' }}
                                </span>
                            </td>
                            <td class="text-right p-1.5 relative z-10">
                                <input 
                                    v-model.number="row.saldo_awal" 
                                    type="number" 
                                    step="0.01" 
                                    class="input input-bordered input-sm w-full text-right font-mono transition-colors group-hover:border-primary/50 focus:border-primary focus:ring-1" 
                                    placeholder="0"
                                />
                            </td>
                        </tr>
                        <tr v-if="!paginatedRows.length && !loading">
                            <td colspan="5" class="text-center text-base-content/50 py-12">
                                Tidak ada data rekening yang cocok.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </AppPagination>
    </div>
</template>
