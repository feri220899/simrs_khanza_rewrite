<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import JenisTab from './JenisTab.vue'
import BarangTab from './BarangTab.vue'
import SuplierTab from './SuplierTab.vue'
import MemberTab from './MemberTab.vue'

// Master Data Toko — Jenis Barang, Barang, Suplier, Member. Modul transaksi
// (Penjualan/Pembelian/Pemesanan/Piutang/Retur) DITUNDA ke Fase 3 (butuh
// integrasi jurnal Keuangan yang belum dibangun), lihat Khanza.md section 14.
const TABS = [
    { key: 'jenis',   label: 'Jenis Barang', permission: 'toko_jenis' },
    { key: 'barang',  label: 'Barang',       permission: 'toko_barang' },
    { key: 'suplier', label: 'Suplier',      permission: 'toko_suplier' },
    { key: 'member',  label: 'Member',       permission: 'toko_member' },
]

const authStore = useAuthStore()
const visible = TABS.filter(t => authStore.can(t.permission))
const active = ref(visible[0]?.key || TABS[0].key)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <h1 class="text-xl font-bold mb-1 shrink-0">Toko — Master Data</h1>
        <p class="text-sm text-base-content/60 mb-3 shrink-0">
            Jenis Barang, Barang, Suplier, Member (src/toko/Toko{Jenis,Barang,Suplier,Member}.java).
            Modul transaksi (Penjualan/Pembelian/Piutang/Retur) ditunda sampai integrasi Keuangan siap.
        </p>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0">
            <a v-for="t in visible" :key="t.key" role="tab" class="tab"
                :class="active === t.key ? 'tab-active' : ''"
                @click="active = t.key">
                {{ t.label }}
            </a>
        </div>

        <p v-if="visible.length === 0" class="text-warning text-sm">
            Anda tidak punya akses ke Master Data Toko mana pun.
        </p>
        <JenisTab v-else-if="active === 'jenis'" />
        <BarangTab v-else-if="active === 'barang'" />
        <SuplierTab v-else-if="active === 'suplier'" />
        <MemberTab v-else />
    </div>
</template>
