<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
    items: { type: Array, default: () => [] },
    depth: { type: Number, default: 1 },
    forceOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['navigate'])
const route = useRoute()
const opened = ref(new Set())
const closed = ref(new Set())

function hasActive(item) {
    if (item.to === route.path) return true
    return item.children?.some(hasActive) || false
}

function toggle(label) {
    const nextOpened = new Set(opened.value)
    const nextClosed = new Set(closed.value)

    if (isOpen({ label })) {
        nextOpened.delete(label)
        nextClosed.add(label)
    } else {
        nextClosed.delete(label)
        nextOpened.add(label)
    }

    opened.value = nextOpened
    closed.value = nextClosed
}

function isOpen(item) {
    return props.forceOpen || opened.value.has(item.label) || (!closed.value.has(item.label) && hasActive(item))
}

function linkClass(path) {
    const base = 'flex items-center gap-2 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors'
    return route.path === path
        ? `${base} bg-primary text-white`
        : `${base} text-white/60 hover:bg-base-200 hover:text-white/80`
}
</script>

<template>
    <ul class="space-y-0.5 ml-2 pl-3 border-l border-base-300">
        <li v-for="item in items" :key="item.to || item.label">
            <template v-if="item.children?.length">
                <button class="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors"
                    :class="hasActive(item) ? 'bg-primary/10 text-primary' : 'text-white/60 hover:bg-base-200 hover:text-white/80'"
                    @click="toggle(item.label)">
                    <component v-if="item.icon" :is="item.icon" class="size-3.5 shrink-0" />
                    <span class="flex-1 text-left truncate">{{ item.label }}</span>
                    <ChevronDown class="size-3.5 shrink-0 transition-transform" :class="isOpen(item) ? 'rotate-180' : ''" />
                </button>
                <SidebarMenuTree v-if="isOpen(item)" :items="item.children" :depth="depth + 1" :force-open="forceOpen" @navigate="emit('navigate')" />
            </template>
            <RouterLink v-else :to="item.to" :class="linkClass(item.to)" @click="emit('navigate')">
                <component v-if="item.icon" :is="item.icon" class="size-3.5 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
            </RouterLink>
        </li>
    </ul>
</template>
