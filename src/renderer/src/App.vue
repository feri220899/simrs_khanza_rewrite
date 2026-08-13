<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import AppUpdater from './components/AppUpdater.vue'

const route = useRoute()
const hasLayout = computed(() => route.meta.layout !== false)
const bisaCetakIpsrs = computed(() => route.path.startsWith('/ipsrs/') && route.path !== '/ipsrs/surat-pemesanan')

function cetakIpsrsAktif() {
    const source = document.querySelector('main')
    const clone = source.cloneNode(true)
    clone.querySelectorAll('button,input,select,dialog,.pagination').forEach(el => el.remove())
    clone.querySelectorAll('[style*="display: none"], [hidden]').forEach(el => el.remove())
    const w = window.open('', '_blank', 'width=1000,height=700')
    if (!w) return
    w.document.write(`<html><head><title>Cetak IPSRS</title><style>body{font:12px Arial;margin:24px}h1{font-size:18px;text-align:center}p{margin:4px 0 12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:5px}th{background:#eee}.text-right{text-align:right}.text-center{text-align:center}</style></head><body>${clone.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
}
</script>

<template>
    <RouterView v-if="!hasLayout" />

    <div v-else class="flex h-screen overflow-hidden bg-base-200/50">
        <AppSidebar />
        <div class="flex flex-col flex-1 overflow-hidden">
            <AppHeader />
            <div v-if="bisaCetakIpsrs" class="px-6 pt-3 flex justify-end shrink-0 bg-base-100/50">
                <button class="btn btn-ghost btn-sm text-primary" @click="cetakIpsrsAktif">Cetak Daftar</button>
            </div>
            <main class="flex-1 overflow-y-auto p-6 flex flex-col">
                <RouterView />
            </main>
        </div>
    </div>

    <AppToast />
    <AppUpdater />
</template>
