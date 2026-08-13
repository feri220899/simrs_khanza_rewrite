<!-- Port apa adanya dari pos-desktop (src/renderer/src/components/AppPagination.vue) -->
<template>
    <div class="flex flex-col min-h-0">

        <!-- Toolbar: Search + Page Size -->
        <div class="flex items-center gap-2 mb-3 shrink-0">
            <label class="input input-sm flex-1">
                <Search class="size-3.5 font-bold opacity-40" />
                <input
                    :value="search"
                    type="text"
                    class="text-base"
                    placeholder="Cari..."
                    @input="$emit('update:search', $event.target.value)"
                />
            </label>
            <select
                :value="table.getState().pagination.pageSize"
                class="select select-sm w-28"
                @change="table.setPageSize(Number($event.target.value))"
            >
                <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }} baris</option>
            </select>
        </div>

        <!-- Slot tabel (scrollable) — `overscroll-contain` matikan efek
             "rubber band"/bounce Chromium pas discroll mentok ke batas
             (paling kentara di tabel dgn baris sedikit spt Satuan, krn jarak
             scroll-nya pendek). Tanpa ini, browser tetap coba scroll-chain
             ke parent lalu mantul balik. -->
        <div class="flex-1 min-h-0 min-w-0 overflow-auto overscroll-contain">
            <slot />
        </div>

        <!-- Footer: Info + Navigasi halaman -->
        <div class="flex items-center justify-between pt-3 mt-2 border-t border-base-300 shrink-0">

            <span class="text-sm text-base-content/50">
                <template v-if="totalRows === 0">Tidak ada data</template>
                <template v-else>{{ from }}–{{ to }} dari {{ totalRows }} data</template>
            </span>

            <div class="flex items-center gap-1">
                <button
                    class="btn btn-ghost btn-sm btn-square"
                    :disabled="!table.getCanPreviousPage()"
                    @click="table.previousPage()"
                >
                    <ChevronLeft class="size-4" />
                </button>

                <template v-for="item in pages" :key="item.key">
                    <span v-if="item.type === 'ellipsis'" class="px-1 text-base-content/40 select-none">…</span>
                    <button
                        v-else
                        class="btn btn-sm btn-square"
                        :class="item.page === currentPage ? 'btn-primary' : 'btn-ghost'"
                        @click="table.setPageIndex(item.page - 1)"
                    >
                        {{ item.page }}
                    </button>
                </template>

                <button
                    class="btn btn-ghost btn-sm btn-square"
                    :disabled="!table.getCanNextPage()"
                    @click="table.nextPage()"
                >
                    <ChevronRight class="size-4" />
                </button>
            </div>

        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Search } from 'lucide-vue-next'

const props = defineProps({
    table:           { type: Object,  required: true },
    search:          { type: String,  default: ''    },
    pageSizeOptions: { type: Array,   default: () => [10, 20, 25, 50, 100] },
})

defineEmits(['update:search'])

const currentPage = computed(() => props.table.getState().pagination.pageIndex + 1)
const pageCount   = computed(() => props.table.getPageCount())
const pageSize    = computed(() => props.table.getState().pagination.pageSize)
const totalRows   = computed(() => props.table.getRowCount())

const from = computed(() => totalRows.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1)
const to   = computed(() => Math.min(currentPage.value * pageSize.value, totalRows.value))

const pages = computed(() => {
    const total   = pageCount.value
    const current = currentPage.value

    if (total <= 5) return range(1, total).map(p => ({ type: 'page', page: p, key: p }))

    const items = []
    const add  = p  => items.push({ type: 'page',    page: p, key: p  })
    const dots = id => items.push({ type: 'ellipsis',          key: id })

    add(1)

    if (current <= 3) {
        range(2, Math.min(3, total - 1)).forEach(add)
        dots('end')
    } else if (current >= total - 3) {
        dots('start')
        range(Math.max(total - 2, 2), total - 1).forEach(add)
    } else {
        dots('start')
        range(current - 1, current + 1).forEach(add)
        dots('end')
    }

    add(total)

    return items
})

function range(from, to) {
    const r = []
    for (let i = from; i <= to; i++) r.push(i)
    return r
}
</script>
