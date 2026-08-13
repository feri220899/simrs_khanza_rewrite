<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import JenisTab from './JenisTab.vue'
import BarangTab from './BarangTab.vue'
import SuplierTab from './SuplierTab.vue'
import SatuanTab from '../toko/SatuanTab.vue'

// Master Data IPSRS — Jenis Barang, Barang, Suplier, Satuan. Modul transaksi
// yang posting jurnal (Pembelian/Penerimaan/Hibah/Pengeluaran/ReturBeli/
// Pengambilan UTD) DITUNDA ke Fase 3, sama prinsipnya dgn Toko — lihat
// Khanza.md. Satuan (kodesatuan) SHARED lintas modul (src/inventory/
// DlgSatuan.java) — dipakai ULANG apa adanya dari `views/toko/SatuanTab.vue`
// (komponennya sudah netral, tidak ada yang Toko-spesifik: service/IPC/
// permission-nya `satuan_barang` sudah shared), BUKAN diduplikasi jadi file
// baru di sini.
const TABS = [
    { key: 'jenis',   label: 'Jenis Barang', permission: 'ipsrs_jenis_barang' },
    { key: 'barang',  label: 'Barang',       permission: 'ipsrs_barang' },
    { key: 'suplier', label: 'Suplier',      permission: 'suplier_penunjang' },
    { key: 'satuan',  label: 'Satuan',       permission: 'satuan_barang' },
]

const authStore = useAuthStore()
const visible = TABS.filter(t => authStore.can(t.permission))
const active = ref(visible[0]?.key || TABS[0].key)
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <h1 class="text-xl font-bold mb-1 shrink-0">IPSRS — Master Data</h1>
        <p class="text-sm text-base-content/60 mb-3 shrink-0">
            Jenis Barang, Barang, Suplier, Satuan (src/ipsrs/IPSRS{Jenis,Barang,Suplier}.java, src/inventory/DlgSatuan.java).
            Modul transaksi yang posting jurnal (Pembelian/Penerimaan/Hibah/Pengeluaran/ReturBeli/Pengambilan UTD) ditunda sampai integrasi Keuangan siap.
        </p>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0">
            <a v-for="t in visible" :key="t.key" role="tab" class="tab cursor-pointer"
                :class="active === t.key ? 'tab-active' : ''"
                @click="active = t.key">
                {{ t.label }}
            </a>
        </div>

        <p v-if="visible.length === 0" class="text-warning text-sm">
            Anda tidak punya akses ke Master Data IPSRS mana pun.
        </p>
        <JenisTab v-else-if="active === 'jenis'" />
        <BarangTab v-else-if="active === 'barang'" />
        <SuplierTab v-else-if="active === 'suplier'" />
        <SatuanTab v-else />
    </div>
</template>
