<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import TaksonomiTab from './TaksonomiTab.vue'

// 9 taksonomi arsip fisik Surat Menyurat, CRUD-nya identik (lihat SOP di
// Khanza.md & SuratTaksonomiService.js) — satu komponen generik dipakai
// ulang, `:key` biar remount bersih tiap ganti jenis.
const JENIS = [
    { jenis: 'rak',         label: 'Rak',          permission: 'surat_rak' },
    { jenis: 'almari',      label: 'Almari',       permission: 'surat_almari' },
    { jenis: 'klasifikasi', label: 'Klasifikasi',  permission: 'surat_klasifikasi' },
    { jenis: 'sifat',       label: 'Sifat',        permission: 'surat_sifat' },
    { jenis: 'map',         label: 'Map',          permission: 'surat_map' },
    { jenis: 'indeks',      label: 'Indeks',       permission: 'surat_indeks' },
    { jenis: 'ruang',       label: 'Ruang',        permission: 'surat_ruang' },
    { jenis: 'status',      label: 'Status',       permission: 'surat_status' },
    { jenis: 'balas',       label: 'Status Balas', permission: 'surat_balas' },
]

const authStore = useAuthStore()
const visible = JENIS.filter(j => authStore.can(j.permission))
const activeJenis = ref(visible[0]?.jenis || JENIS[0].jenis)
const active = () => JENIS.find(j => j.jenis === activeJenis.value)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <h1 class="text-xl font-bold mb-1 shrink-0">Surat Menyurat</h1>
        <p class="text-sm text-base-content/60 mb-3 shrink-0">
            Taksonomi arsip fisik surat (src/surat/Surat{Rak,Almari,Klasifikasi,Sifat,Map,Indeks,Ruang,Status,Balas}.java).
            <code>SuratMasuk</code>/<code>SuratKeluar</code> & template surat klinis TIDAK digarap di sini —
            aslinya pakai JavaFX WebView tanpa sentuh database, butuh investigasi arsitektur terpisah.
        </p>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0">
            <a v-for="j in visible" :key="j.jenis" role="tab" class="tab"
                :class="activeJenis === j.jenis ? 'tab-active' : ''"
                @click="activeJenis = j.jenis">
                {{ j.label }}
            </a>
        </div>

        <p v-if="visible.length === 0" class="text-warning text-sm">
            Anda tidak punya akses ke taksonomi Surat Menyurat mana pun.
        </p>
        <TaksonomiTab v-else :key="activeJenis" :jenis="active().jenis" :label="active().label" :permission="active().permission" />
    </div>
</template>
