# AGENTS.md — khanza-desktop

Baca file ini duluan di tiap sesi baru, sebelum mengerjakan modul apapun.

## Konteks wajib (urutan baca)

1. **`../SIMRS-Khanza/Khanza.md`** — dokumen utama: mapping tiap modul ke
   dialog/package Java asli, tabel DB terkait, urutan migrasi (Fase 0–6),
   keputusan arsitektur (auth, WebView hybrid, lisensi, MinIO, dll), dan
   koreksi-koreksi hasil audit. **Ini rencana & status kerja yang sebenarnya**
   — bukan `README.md` di repo ini (README isinya cuma catatan teknis
   run/build, bukan rencana pengerjaan).
2. **`README.md`** (repo ini) — cara jalankan project, pivot MySQL, konvensi
   IPC/service/Vue.
3. **`../SIMRS-Khanza/AGENTS.md`** — aturan soal repo referensi (`SIMRS-Khanza`
   itu clone upstream, jangan disunting, dst).

## JANGAN percaya buta checklist status

Baik `Khanza.md` > "Status" maupun `README.md` > "Status implementasi" **bisa
basi** — pernah kejadian keduanya bilang suatu fase "belum mulai/placeholder"
padahal kode sungguhan (`src/main/db/modules/EEksekutif*.js`,
`src/renderer/src/views/eeksekutif/*`) sudah jauh lebih maju. **Sebelum
menjawab atau melanjutkan pekerjaan apapun soal progress**, verifikasi dulu:

```
git log --oneline -15          # commit apa yang terakhir masuk
git status --short             # ada kerjaan uncommitted yang lagi jalan?
find src -iname "*<ModulX>*"   # cek file relevan beneran ada/belum
```

Baru simpulkan status sebenarnya dari situ, bukan dari dokumen.

## Disiplin update dokumentasi (WAJIB, bukan opsional)

Setelah menyelesaikan satu modul/sub-fitur:
1. Update checklist "Status" di `Khanza.md` (dan `README.md` kalau relevan) —
   sebutkan modul apa yang selesai, apa yang masih sisa (kalau modul besar
   dipecah sub-halaman, sebutkan berapa dari berapa, contoh: "Kendali Mutu &
   Biaya: 2/7 sub-laporan selesai — Poli & Rawat Jalan; sisa Apotek/Lab
   PA/PK/MB/Radiologi").
2. Kalau menemukan bagian `Khanza.md` yang ternyata salah/basi saat
   investigasi source PHP/Java asli, **koreksi langsung di tempat** (pola
   blockquote `⚠️ **Koreksi (tanggal)**: ...` yang sudah dipakai di dokumen
   itu — jelaskan apa yang salah, kenapa, gimana ketemunya).

Tujuannya: sesi berikutnya (tool apapun — Claude Code, OpenCode, dll) bisa
langsung lanjut tanpa di-brief ulang dari nol oleh user.

## Arsitektur inti (ringkasan — detail penuh di Khanza.md)

- **MySQL langsung ke database `sik` yang sama** dengan app Java asli (bukan
  Postgres, bukan ETL/cutover dua-mesin). Driver `mysql2`.
- **Tidak ada backend server** — tiap client connect langsung ke MySQL lewat
  main process, expose ke renderer via IPC (`ipcMain.handle` + `contextBridge`).
- Auth: role/permission ternormalisasi (`electron_roles/permissions/
  role_permissions/user_roles`), tapi login pakai tabel `admin`/`user` ASLI
  (AES_ENCRYPT, sama seperti Java) — **bukan** tabel `electron_users` terpisah.
- Modul yang masih dipakai bareng app Java berbagi tabel real-time — hati-hati
  race condition, ikuti urutan migrasi (Fase 0–6) di `Khanza.md`, jangan
  loncat fase tanpa alasan.

## Konvensi lain
- Jawab dalam Bahasa Indonesia (istilah teknis boleh Inggris).
- Jangan install package/dependency atau ubah `.env`/kredensial tanpa
  konfirmasi eksplisit.
- Jangan push ke remote tanpa diminta.
