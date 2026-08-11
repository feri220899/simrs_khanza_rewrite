<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import TaksonomiTab from './TaksonomiTab.vue'
import PenerbitTab from './PenerbitTab.vue'

// 5 master data Perpustakaan (4 taksonomi generik + Penerbit yang 6 kolom),
// digabung 1 halaman ber-tab — mirip pola Surat.vue, tapi Penerbit dapat
// komponen sendiri (PenerbitTab.vue) karena field-nya lebih banyak.
const JENIS = [
    { jenis: 'jenis',     label: 'Jenis Koleksi', permission: 'jenis_perpustakaan' },
    { jenis: 'ruang',     label: 'Ruang',         permission: 'ruang_perpustakaan' },
    { jenis: 'pengarang', label: 'Pengarang',     permission: 'pengarang_perpustakaan' },
    { jenis: 'kategori',  label: 'Kategori',      permission: 'kategori_perpustakaan' },
    { jenis: 'penerbit',  label: 'Penerbit',      permission: 'penerbit_perpustakaan' },
]

const authStore = useAuthStore()
const visible = JENIS.filter(j => authStore.can(j.permission))
const activeJenis = ref(visible[0]?.jenis || JENIS[0].jenis)
const active = () => JENIS.find(j => j.jenis === activeJenis.value)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <h1 class="text-xl font-bold mb-1 shrink-0">Perpustakaan — Master Data</h1>
        <p class="text-sm text-base-content/60 mb-3 shrink-0">
            Data acuan katalog: Jenis Koleksi, Ruang, Pengarang, Kategori, Penerbit
            (src/perpustakaan/Perpustakaan{Jenis,Ruang,Pengarang,Kategori,Penerbit}.java).
        </p>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0">
            <a v-for="j in visible" :key="j.jenis" role="tab" class="tab"
                :class="activeJenis === j.jenis ? 'tab-active' : ''"
                @click="activeJenis = j.jenis">
                {{ j.label }}
            </a>
        </div>

        <p v-if="visible.length === 0" class="text-warning text-sm">
            Anda tidak punya akses ke master data Perpustakaan mana pun.
        </p>
        <PenerbitTab v-else-if="active().jenis === 'penerbit'" :key="activeJenis" />
        <TaksonomiTab v-else :key="activeJenis" :jenis="active().jenis" :label="active().label" :permission="active().permission" />
    </div>
</template>
