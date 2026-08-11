// Port apa adanya dari pos-desktop (src/renderer/src/composables/useServerTable.js)
// — logic-nya generik (TanStack Table + fetchFn), tidak terikat Express, jadi
// bisa dipakai persis sama meski `fetchFn` kita manggil IPC bukan axios.
// LIHAT Khanza.md > "Konvensi UI" sebelum bikin halaman list baru — WAJIB
// pakai ini + AppServerTable, jangan tulis pagination manual per halaman.
import { ref, reactive, watch } from 'vue'
import {
    useVueTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
} from '@tanstack/vue-table'

export function useServerTable({ columns, fetchFn, pageSize = 10, immediate = true, defaultSortBy = 'id', defaultSortOrder = 'asc' }) {
    const data    = ref([])
    const total   = ref(0)
    const loading = ref(false)
    const sorting = ref([])
    const search  = ref('')

    const pagination = reactive({ pageIndex: 0, pageSize })

    let debounceTimer = null

    async function fetchData() {
        loading.value = true
        try {
            const sort = sorting.value[0]
            const res  = await fetchFn({
                page:      pagination.pageIndex + 1,
                pageSize:  pagination.pageSize,
                sortBy:    sort?.id ?? defaultSortBy,
                sortOrder: sort ? (sort.desc ? 'desc' : 'asc') : defaultSortOrder,
                search:    search.value,
            })
            // ADAPTASI dari referensi: pos-desktop bacanya `res.data?.data` /
            // `res.data?.total` karena fetchFn di sana balikin response axios
            // (dibungkus `.data` sama axios, lalu `.data` lagi dari body API).
            // Kita manggil IPC langsung (bukan HTTP), jadi `fetchFn` balikin
            // objek `{ data, total }` polos — SATU level, bukan dua.
            data.value  = res?.data  ?? []
            total.value = res?.total ?? 0
        } catch (e) {
            data.value  = []
            total.value = 0
            console.error('[useServerTable] fetchData error:', e)
        } finally {
            loading.value = false
        }
    }

    const table = useVueTable({
        get data()     { return data.value  },
        get rowCount() { return total.value },
        columns,
        state: {
            get pagination() { return pagination    },
            get sorting()    { return sorting.value },
        },
        manualPagination: true,
        manualSorting:    true,
        getCoreRowModel:       getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel:     getSortedRowModel(),
        onPaginationChange: updater => {
            const next = typeof updater === 'function' ? updater(pagination) : updater
            pagination.pageIndex = next.pageIndex
            pagination.pageSize  = next.pageSize
        },
        onSortingChange: updater => {
            sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
            pagination.pageIndex = 0
        },
    })

    watch([() => pagination.pageIndex, () => pagination.pageSize, sorting], fetchData, {
        immediate,
        deep: true,
    })

    watch(search, () => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
            pagination.pageIndex = 0
            fetchData()
        }, 600)
    })

    return { table, loading, search, fetchData }
}
