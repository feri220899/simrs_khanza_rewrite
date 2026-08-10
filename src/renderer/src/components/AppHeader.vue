<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { buildBreadcrumbs } from '../config/menu'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const crumbs = computed(() => buildBreadcrumbs(route.path))

function logout() {
    authStore.logout()
    router.push('/login')
}
</script>

<template>
    <header class="h-16 shrink-0 border-b border-base-300 bg-base-100 flex items-center justify-between px-6">
        <div class="flex items-center gap-2 text-sm text-base-content/70">
            <template v-for="(c, i) in crumbs" :key="i">
                <component :is="c.icon" v-if="c.icon" class="size-4" />
                <span :class="i === crumbs.length - 1 ? 'font-semibold text-base-content' : ''">{{ c.label }}</span>
                <span v-if="i < crumbs.length - 1">/</span>
            </template>
        </div>

        <div class="flex items-center gap-3">
            <span class="text-sm">{{ authStore.user?.username }} · {{ authStore.user?.role }}</span>
            <button class="btn btn-ghost btn-sm" @click="logout">
                <LogOut class="size-4" /> Keluar
            </button>
        </div>
    </header>
</template>
