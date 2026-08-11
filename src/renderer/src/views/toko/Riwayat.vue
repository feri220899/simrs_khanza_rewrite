<script setup>
import { h } from 'vue'
import { FlexRender } from '@tanstack/vue-table'
import { History } from 'lucide-vue-next'
import { useServerTable } from '../../composables/useServerTable.js'
import AppPagination from '../../components/AppPagination.vue'

// src/toko/TokoRiwayatBarang.java — viewer read-only murni (tidak ada
// insert/update/delete di file aslinya). Untuk saat ini cuma keisi dari
// Stok Opname (posisi='Opname') — riwayat dari transaksi Penjualan/
// Pembelian/dst baru muncul kalau modul itu digarap di Fase 3.
const columns = [
    { accessorKey: 'tanggal', header: 'Tanggal', meta: { headerClass: 'w-28' } },
    { accessorKey: 'jam', header: 'Jam', meta: { headerClass: 'w-24' } },
    { accessorKey: 'nama_brng', header: 'Barang' },
    { accessorKey: 'stok_awal', header: 'Stok Awal', meta: { headerClass: 'w-28 text-right', cellClass: 'text-right tabular-nums' } },
    { accessorKey: 'masuk', header: 'Masuk', meta: { headerClass: 'w-24 text-right', cellClass: 'text-right tabular-nums text-success' } },
    { accessorKey: 'keluar', header: 'Keluar', meta: { headerClass: 'w-24 text-right', cellClass: 'text-right tabular-nums text-error' } },
    { accessorKey: 'stok_akhir', header: 'Stok Akhir', meta: { headerClass: 'w-28 text-right', cellClass: 'text-right tabular-nums font-medium' } },
    { accessorKey: 'posisi', header: 'Posisi', enableSorting: false, meta: { headerClass: 'w-28' } },
    { accessorKey: 'petugas', header: 'Petugas', enableSorting: false },
]

const { table, loading, search } = useServerTable({
    columns,
    fetchFn: params => window.api.toko.riwayat.list(params),
    pageSize: 15,
    defaultSortBy: 'tanggal',
    defaultSortOrder: 'desc',
})
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-4 shrink-0">
            <h1 class="text-2xl font-bold tracking-tight">Toko — Riwayat Barang</h1>
            <p class="text-sm text-base-content/60 mt-0.5">Log pergerakan stok, read-only (src/toko/TokoRiwayatBarang.java)</p>
        </div>

        <div class="flex-1 min-h-0 overflow-hidden">
            <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm h-full flex flex-col overflow-hidden px-4 py-3">
                <AppPagination :table="table" v-model:search="search" class="flex-1 min-h-0">
                    <table class="table">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-base-200 border-b-2 border-base-300">
                                <th v-for="header in table.getFlatHeaders()" :key="header.id"
                                    :class="['text-sm font-medium py-2', header.column.columnDef.meta?.headerClass]">
                                    <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="9" class="py-16 text-center"><span class="loading loading-spinner loading-md text-primary"></span></td></tr>
                            <tr v-else-if="table.getRowModel().rows.length === 0">
                                <td colspan="9" class="py-16 text-center">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
                                            <History class="size-7 text-base-content/30" />
                                        </div>
                                        <p class="font-semibold text-base-content/60">Belum ada riwayat pergerakan stok</p>
                                    </div>
                                </td>
                            </tr>
                            <tr v-else v-for="row in table.getRowModel().rows" :key="row.id" class="border-b border-base-200 hover:bg-primary/5">
                                <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="['py-2', cell.column.columnDef.meta?.cellClass]">
                                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </AppPagination>
            </div>
        </div>
    </div>
</template>
