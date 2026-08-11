// Port apa adanya dari pos-desktop (src/renderer/src/composables/useToast.js)
import { ref } from 'vue'

const toasts = ref([])

function showToast(message, type = 'success') {
    const id = Date.now()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
}

export function useToast() {
    return { toasts, showToast }
}
