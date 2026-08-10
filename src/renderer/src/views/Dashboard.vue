<script setup>
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
</script>

<template>
    <div>
        <h1 class="text-xl font-bold">Selamat datang, {{ authStore.user?.username }}</h1>
        <p class="text-sm text-base-content/60 mt-1">
            Khanza Desktop — scaffold awal. Lihat Khanza.md di repo SIMRS-Khanza untuk roadmap lengkap modul.
        </p>
    </div>
</template>
