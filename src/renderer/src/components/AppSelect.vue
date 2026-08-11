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
</template>
