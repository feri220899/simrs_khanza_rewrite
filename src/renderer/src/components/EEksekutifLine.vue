<script setup>
import { computed } from 'vue'

const props = defineProps({
    title: { type: String, required: true },
    data: { type: Array, default: () => [] },
    color: { type: String, default: '#e91e63' },
})

const chartWidth = computed(() => Math.max(props.data.length * 75, 450))
const chartHeight = 240
const padding = { top: 30, right: 30, bottom: 50, left: 40 }

const maxValue = computed(() => {
    const max = Math.max(...props.data.map(d => Number(d.value || 0)), 0)
    return max === 0 ? 1 : max
})

const points = computed(() => {
    if (!props.data.length) return []
    const w = chartWidth.value - padding.left - padding.right
    const h = chartHeight - padding.top - padding.bottom
    const step = props.data.length > 1 ? w / (props.data.length - 1) : w / 2

    return props.data.map((item, i) => {
        const val = Number(item.value || 0)
        const x = props.data.length === 1 ? padding.left + w / 2 : padding.left + i * step
        const y = padding.top + h - (val / maxValue.value) * h
        const cleanLabel = (item.label || '').split(' (')[0]
        return { x, y, val, label: item.label, cleanLabel }
    })
})

const polylinePoints = computed(() => points.value.map(p => `${p.x},${p.y}`).join(' '))
</script>

<template>
    <section class="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden min-h-[25rem]">
        <header class="px-4 py-3 text-center font-medium border-b border-base-200">{{ title }}</header>
        <div v-if="!data.length" class="h-80 grid place-items-center text-base-content/50">Kosong</div>
        <div v-else class="p-4 overflow-x-auto">
            <svg :width="chartWidth" :height="chartHeight" class="mx-auto block overflow-visible">
                <line :x1="padding.left" :y1="padding.top" :x2="padding.left" :y2="chartHeight - padding.bottom" stroke="currentColor" stroke-dasharray="2 2" class="text-base-300" />
                <line :x1="padding.left" :y1="chartHeight - padding.bottom" :x2="chartWidth - padding.right" :y2="chartHeight - padding.bottom" stroke="currentColor" class="text-base-300" />

                <polyline fill="none" :stroke="color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :points="polylinePoints" />

                <g v-for="(p, idx) in points" :key="idx">
                    <circle :cx="p.x" :cy="p.y" r="4.5" :fill="color" stroke="#ffffff" stroke-width="1.5" />
                    <text :x="p.x" :y="p.y - 9" text-anchor="middle" font-size="11" class="fill-base-content font-medium">{{ p.val }}</text>
                    <text :x="p.x" :y="chartHeight - padding.bottom + 18" text-anchor="middle" font-size="11" class="fill-base-content/70" transform-origin="center">{{ p.cleanLabel }}</text>
                </g>
            </svg>
        </div>
    </section>
</template>
