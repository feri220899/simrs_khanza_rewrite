<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
    <div class="flex-1 flex items-center justify-center">
        <div class="text-center text-base-content/50">
            <p class="text-lg font-semibold">Belum diimplementasikan</p>
            <p class="text-sm mt-1">{{ route.path }}</p>
            <p class="text-xs mt-4 max-w-md mx-auto">
                Ikuti SOP di Khanza.md sebelum membangun halaman ini — baca dulu
                kode Java asli modul terkait, trace query SQL & logic bisnisnya.
            </p>
        </div>
    </div>
</template>
