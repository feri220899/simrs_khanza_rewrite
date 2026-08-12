<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useToast } from '../../composables/useToast.js'
import { useAuthStore } from '../../stores/auth.js'

// src/perpustakaan/PerpustakaanPengaturanPeminjaman.java — config 1 baris
// (max_pinjam, lama_pinjam, denda_perhari). Java asli TIDAK ada pengecekan
// akses sama sekali (oversight) — di sini SENGAJA digate ke permission
// 'set_peminjaman_perpustakaan' (ada di sik.sql), lihat komentar di
// PerpustakaanPengaturanService.js.
const { showToast } = useToast()
const authStore = useAuthStore()
const bolehTulis = () => authStore.can('set_peminjaman_perpustakaan')

const loading = ref(true)
const saving = ref(false)
const ada = ref(false)
const form = reactive({ max_pinjam: '', lama_pinjam: '', denda_perhari: '' })

async function muat() {
    loading.value = true
    const data = await window.api.perpustakaan.pengaturan.get()
    ada.value = !!data
    Object.assign(form, data || { max_pinjam: '', lama_pinjam: '', denda_perhari: '' })
    loading.value = false
}

async function simpan() {
    saving.value = true
    try {
        const res = await window.api.perpustakaan.pengaturan.upsert(authStore.token, { ...form })
        if (!res.success) { showToast(res.message, 'error'); return }
        showToast('Pengaturan Peminjaman berhasil disimpan.')
        muat()
    } finally {
        saving.value = false
    }
}

onMounted(muat)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <h1 class="text-xl font-bold mb-1 shrink-0">Perpustakaan — Pengaturan Peminjaman</h1>
        <p class="text-sm text-base-content/60 mb-4 shrink-0">
            Batas jumlah pinjam, lama pinjam, dan denda per hari keterlambatan
            (src/perpustakaan/PerpustakaanPengaturanPeminjaman.java)
        </p>

        <div v-if="loading" class="flex-1 flex items-center justify-center">
            <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
        <div v-else class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden max-w-xl">
            <div class="px-5 py-3.5 border-b border-base-200 flex items-center gap-3">
                <div class="w-1 h-5 bg-primary rounded-full"></div>
                <h3 class="font-semibold text-base-content">Pengaturan Saat Ini</h3>
            </div>
            <div class="p-5">
                <div v-if="!ada" class="alert alert-warning mb-4 text-sm">
                    Belum ada pengaturan — modul Sirkulasi (pinjam buku) tidak bisa dipakai sampai ini diisi.
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Maksimal Buku Dipinjam <span class="text-error">*</span></label>
                        <input v-model="form.max_pinjam" type="number" min="1" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Lama Peminjaman (hari) <span class="text-error">*</span></label>
                        <input v-model="form.lama_pinjam" type="number" min="1" class="input input-bordered input-sm w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-base-content/80 mb-1.5">Denda per Hari (Rp) <span class="text-error">*</span></label>
                        <input v-model="form.denda_perhari" type="number" min="0" class="input input-bordered input-sm w-full" @keyup.enter="simpan" />
                    </div>
                </div>
                <p v-if="!bolehTulis()" class="text-warning text-sm mt-3">Anda tidak punya akses mengubah pengaturan ini.</p>
                <div class="mt-4">
                    <button class="btn btn-primary gap-2" :disabled="saving || !bolehTulis()" @click="simpan">
                        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
