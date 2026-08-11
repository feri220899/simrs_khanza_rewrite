<!-- Port apa adanya dari pos-desktop (src/renderer/src/components/AppServerTable.vue) -->
<script setup>
import { computed } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import AppPagination from './AppPagination.vue'

const props = defineProps({
    table:           { type: Object,  required: true },
    loading:         { type: Boolean, default: false },
    search:          { type: String,  default: '' },
    emptyText:       { type: String,  default: 'Tidak ada data' },
    pageSizeOptions: { type: Array,   default: () => [10, 20, 25, 50, 100] },
})
defineEmits(['update:search'])

const colCount = computed(() => props.table.getVisibleLeafColumns().length)
</script>

<template>
    <AppPagination :table="table" :search="search" :pageSizeOptions="pageSizeOptions"
        @update:search="$emit('update:search', $event)" class="flex-1 min-h-0">
        <table class="table">
            <thead class="sticky top-0 z-10">
                <tr class="bg-base-200 border-b-2 border-base-300">
                    <th v-for="header in table.getFlatHeaders()" :key="header.id"
                        :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass,
                                 header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary transition-colors' : '']"
                        @click="header.column.getToggleSortingHandler()?.($event)">
                        <div :class="['flex items-center gap-1',
                                      header.column.columnDef.meta?.headerClass?.includes('text-right') ? 'justify-end'
                                      : header.column.columnDef.meta?.headerClass?.includes('text-center') ? 'justify-center' : '']">
                            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                            <span v-if="header.column.getIsSorted() === 'asc'" class="text-primary">↑</span>
                            <span v-else-if="header.column.getIsSorted() === 'desc'" class="text-primary">↓</span>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="loading">
                    <td :colspan="colCount" class="py-16 text-center">
                        <span class="loading loading-spinner loading-md text-primary"></span>
                    </td>
                </tr>
                <tr v-else-if="table.getRowModel().rows.length === 0">
                    <td :colspan="colCount" class="py-16 text-center text-sm text-base-content/50">{{ emptyText }}</td>
                </tr>
                <tr v-else v-for="row in table.getRowModel().rows" :key="row.id"
                    class="border-b border-base-200 hover:bg-primary/5 transition-colors duration-100">
                    <td v-for="cell in row.getVisibleCells()" :key="cell.id"
                        :class="['py-1.5 text-sm', cell.column.columnDef.meta?.cellClass]">
                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                    </td>
                </tr>
            </tbody>
        </table>
    </AppPagination>
</template>
