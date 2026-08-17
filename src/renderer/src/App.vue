<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import AppUpdater from './components/AppUpdater.vue'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const hasLayout = computed(() => route.meta.layout !== false)

// Jadwalkan auto-logout untuk token lama (dari localStorage) saat app dibuka.
onMounted(() => useAuthStore().scheduleAutoLogout())
</script>

<template>
    <RouterView v-if="!hasLayout" />

    <div v-else class="flex h-screen overflow-hidden bg-base-200/50">
        <AppSidebar />
        <div class="flex flex-col flex-1 overflow-hidden">
            <AppHeader />
            <main class="flex-1 overflow-y-auto p-4 flex flex-col">
                <RouterView v-slot="{ Component, route }">
                    <component :is="Component" :key="route.fullPath" />
                </RouterView>
            </main>
        </div>
    </div>

    <AppToast />
    <AppUpdater />
</template>
