<script setup>
import { computed } from 'vue'

const props = defineProps({
    title: { type: String, required: true },
    data: { type: Array, default: () => [] },
})

const colors = ['#e91e63', '#00bcd4', '#8bc34a', '#03a9f4', '#009688', '#ff9800', '#ff5722', '#9e9e9e', '#673ab7', '#ffc107', '#795548', '#2196f3']
const total = computed(() => props.data.reduce((sum, item) => sum + Number(item.value || 0), 0))
const slices = computed(() => {
    let offset = 0
    return props.data.map((item, index) => {
        const value = Number(item.value || 0)
        const percent = total.value ? (value / total.value) * 100 : 0
        const result = { ...item, color: colors[index % colors.length], dash: `${percent} ${100 - percent}`, offset: -offset }
        offset += percent
        return result
    })
})
</script>

<template>
    <section class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden min-h-[25rem]">
        <header class="px-4 py-3 text-center font-medium border-b border-base-200">{{ title }}</header>
        <div v-if="!data.length" class="h-80 grid place-items-center text-base-content/50">Kosong</div>
        <div v-else class="p-5 flex flex-col lg:flex-row items-center justify-center gap-5">
            <svg viewBox="0 0 42 42" class="w-64 h-64 shrink-0 -rotate-90" aria-hidden="true">
                <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="currentColor" class="text-base-200" stroke-width="8" />
                <circle v-for="item in slices" :key="item.label" cx="21" cy="21" r="15.9155" fill="transparent" :stroke="item.color" stroke-width="8" :stroke-dasharray="item.dash" :stroke-dashoffset="item.offset" />
            </svg>
            <ul class="space-y-1.5 text-xs w-full max-h-64 overflow-y-auto">
                <li v-for="item in slices" :key="item.label" class="flex items-start gap-2"><span class="mt-0.5 size-3 rounded-sm shrink-0" :style="{ backgroundColor: item.color }"></span><span>{{ item.label }}</span></li>
            </ul>
        </div>
    </section>
</template>
