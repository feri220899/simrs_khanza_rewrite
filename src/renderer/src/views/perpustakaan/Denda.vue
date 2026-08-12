<script setup>
import { ref } from 'vue'
import DendaJenisTab from './DendaJenisTab.vue'
import BayarDendaHarianTab from './BayarDendaHarianTab.vue'
import BayarDendaLainTab from './BayarDendaLainTab.vue'

// src/perpustakaan/PerpustakaanDenda.java (taksonomi) + PerpustakaanBayarDenda.java
// (2 sub-tab: Keterlambatan/Lain-lain) — digabung 1 halaman ber-tab.
const TABS = [
    { key: 'jenis',   label: 'Jenis Denda' },
    { key: 'harian',  label: 'Bayar Denda — Keterlambatan' },
    { key: 'lain',    label: 'Bayar Denda — Lain-lain' },
]
const active = ref('jenis')
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <h1 class="text-xl font-bold mb-1 shrink-0">Perpustakaan — Denda</h1>
        <p class="text-sm text-base-content/60 mb-3 shrink-0">
            Jenis denda & pencatatan pembayaran (src/perpustakaan/PerpustakaanDenda.java, PerpustakaanBayarDenda.java)
        </p>

        <div role="tablist" class="tabs tabs-boxed mb-3 w-fit shrink-0">
            <a v-for="t in TABS" :key="t.key" role="tab" class="tab cursor-pointer"
                :class="active === t.key ? 'tab-active' : ''"
                @click="active = t.key">
                {{ t.label }}
            </a>
        </div>

        <DendaJenisTab v-if="active === 'jenis'" />
        <BayarDendaHarianTab v-else-if="active === 'harian'" />
        <BayarDendaLainTab v-else />
    </div>
</template>
