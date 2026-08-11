<!-- Port apa adanya dari pos-desktop (src/renderer/src/components/AppToast.vue) -->
<template>
    <div class="toast toast-end z-9999">
        <transition-group name="toast">
            <div
                v-for="toast in toasts"
                :key="toast.id"
                class="alert shadow-lg"
                :class="toast.type === 'success' ? 'alert-success' : toast.type === 'warning' ? 'alert-warning' : 'alert-error'"
            >
                <CheckCircle v-if="toast.type === 'success'" class="size-4 shrink-0" />
                <AlertTriangle v-else-if="toast.type === 'warning'" class="size-4 shrink-0" />
                <XCircle v-else class="size-4 shrink-0" />
                <span class="text-sm">{{ toast.message }}</span>
            </div>
        </transition-group>
    </div>
</template>

<script setup>
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const { toasts } = useToast()
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from, .toast-leave-to      { opacity: 0; transform: translateX(1rem); }
</style>
