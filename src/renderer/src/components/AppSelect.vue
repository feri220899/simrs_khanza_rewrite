<script setup>
import Multiselect from '@vueform/multiselect'
import '@vueform/multiselect/themes/default.css'

// Dropdown pencarian (gaya Select2) buat data referensi/FK yang bisa panjang
// (Anggota, Buku/Inventaris, Penerbit, Pengarang, dst) — dipakai ulang lintas
// halaman Perpustakaan (& modul lain ke depannya). Untuk dropdown enum kecil
// (Jenis Kelamin, Sistem Harian/Jam, dst, cuma 2-5 opsi tetap) TETAP pakai
// `<select>` native biasa — search tidak menambah manfaat di situ, lihat
// Konvensi UI di Khanza.md.
//
// `options` HARUS array of object (bukan array primitif), field kode/label-nya
// dipetakan lewat `valueProp`/`label` (nama field beda-beda per tabel di
// Perpustakaan — no_anggota/nama_anggota, kode_penerbit/nama_penerbit, dst —
// bukan diseragamkan paksa, biar tetap 1:1 sama nama kolom asli).
defineProps({
    modelValue: { type: [String, Number, null], default: null },
    options: { type: Array, required: true },
    valueProp: { type: String, required: true },
    label: { type: String, required: true },
    placeholder: { type: String, default: 'Pilih...' },
    disabled: { type: Boolean, default: false },
})
defineEmits(['update:modelValue', 'change'])
</script>

<template>
    <div class="app-select-sm">
        <Multiselect
            :model-value="modelValue"
            @update:model-value="v => $emit('update:modelValue', v)"
            @change="v => $emit('change', v)"
            :options="options"
            :value-prop="valueProp"
            :label="label"
            :searchable="true"
            :disabled="disabled"
            :placeholder="placeholder"
            no-results-text="Tidak ditemukan"
            no-options-text="Belum ada data"
        />
    </div>
</template>

<style scoped>
/* Tema default Multiselect (lihat import di atas) tingginya ~40px lewat
   formula `calc(border*2 + font-size*line-height + py*2)` (skala "md"
   daisyUI) — beda dari `input-sm`/`select-sm` yang PERSIS 2rem/32px
   (dikonfirmasi dari CSS daisyUI: `--in-size-mul:8` * `--size-field:.25rem`),
   jadi baris form yang campur AppSelect + input biasa tidak sejajar.
   SENGAJA override `min-height` LANGSUNG (bukan cuma variabel `--ms-py` dkk
   yang dipakai formula di atas) — override lewat variabel gampang salah
   satuan (`--ms-line-height` itu ANGKA TANPA SATUAN, dikalikan ke font-size
   di formulanya; sempat kepasang `1.25rem` yang bikin calc()-nya invalid dan
   tingginya malah balik ke auto/default). Override langsung lebih aman &
   presisi. HARUS pakai :deep() karena `.multiselect` di-render oleh
   komponen anak, bukan ditulis langsung di template ini. */
.app-select-sm :deep(.multiselect),
.app-select-sm :deep(.multiselect-wrapper) {
    min-height: 2rem;
}
.app-select-sm :deep(.multiselect) {
    --ms-font-size: 0.75rem;
    --ms-px: 0.75rem;
    --ms-radius: 0.5rem;
    --ms-option-font-size: 0.75rem;
    --ms-tag-font-size: 0.75rem;
}
</style>
