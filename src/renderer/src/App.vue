<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import AppUpdater from './components/AppUpdater.vue'

const route = useRoute()
const hasLayout = computed(() => route.meta.layout !== false)
</script>

<template>
    <RouterView v-if="!hasLayout" />

    <div v-else class="flex h-screen overflow-hidden bg-base-200/50">
        <AppSidebar />
        <div class="flex flex-col flex-1 overflow-hidden">
            <AppHeader />
            <main class="flex-1 overflow-y-auto p-6 flex flex-col">
                <RouterView />
            </main>
        </div>
    </div>

    <AppToast />
    <AppUpdater />
</template>
