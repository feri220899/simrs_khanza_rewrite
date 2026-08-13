import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// Error renderer (BEDA dari uncaughtException main process, lihat
// LogService.js) — ditangkap di 3 lapis: dalam komponen Vue (errorHandler),
// error JS biasa di luar Vue (window 'error'), dan Promise yang reject tanpa
// .catch (window 'unhandledrejection'). Semua diteruskan ke file log yang
// SAMA di main process lewat IPC, bukan file terpisah.
app.config.errorHandler = (err, instance, info) => {
    console.error(err)
    window.api?.log?.reportError(err?.message ?? String(err), { info, stack: err?.stack })
}
window.addEventListener('error', (event) => {
    window.api?.log?.reportError(event.message, { filename: event.filename, lineno: event.lineno, stack: event.error?.stack })
})
window.addEventListener('unhandledrejection', (event) => {
    window.api?.log?.reportError(String(event.reason?.message ?? event.reason), { stack: event.reason?.stack })
})

app
    .use(createPinia())
    .use(router)
    .mount('#app')
