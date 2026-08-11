<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import TaksonomiTab from './TaksonomiTab.vue'
import MasukKeluarTab from './MasukKeluarTab.vue'

// Surat Masuk/Keluar (fungsi utama) + 9 taksonomi arsip fisik pendukung.
// SuratMasuk/SuratKeluar TERNYATA bisa digarap — Java-nya cuma shell WebView,
// tapi logic aslinya ada di PHP webapps/surat/ yang sudah diinvestigasi &
// di-porting (lihat SuratMasukKeluarService.js & Khanza.md > "Arsitektur
// Hybrid WebView"). Template surat klinis (RM) TETAP di luar cakupan ini.
const JENIS = [
    { jenis: 'masuk',       label: 'Surat Masuk',  permission: 'surat_masuk',  type: 'masukKeluar' },
    { jenis: 'keluar',      label: 'Surat Keluar', permission: 'surat_keluar', type: 'masukKeluar' },
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
            Surat Masuk/Keluar (src/surat/SuratMasuk.java, SuratKeluar.java — shell WebView, logic aslinya
            di PHP <code>webapps/surat/</code>) + taksonomi arsip fisik pendukung
            (src/surat/Surat{Rak,Almari,Klasifikasi,Sifat,Map,Indeks,Ruang,Status,Balas}.java).
        </p>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0 flex-wrap">
            <a v-for="j in visible" :key="j.jenis" role="tab" class="tab"
                :class="activeJenis === j.jenis ? 'tab-active' : ''"
                @click="activeJenis = j.jenis">
                {{ j.label }}
            </a>
        </div>

        <p v-if="visible.length === 0" class="text-warning text-sm">
            Anda tidak punya akses ke Surat Menyurat mana pun.
        </p>
        <MasukKeluarTab v-else-if="active().type === 'masukKeluar'" :key="activeJenis" :jenis="active().jenis" />
        <TaksonomiTab v-else :key="activeJenis" :jenis="active().jenis" :label="active().label" :permission="active().permission" />
    </div>
</template>
