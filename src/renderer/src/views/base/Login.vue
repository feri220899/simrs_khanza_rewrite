<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
    error.value = ''
    loading.value = true
    try {
        const res = await authStore.login(username.value, password.value)
        if (!res.success) {
            error.value = res.message
            return
        }
        router.push('/dashboard')
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="h-screen flex items-center justify-center bg-base-200">
        <form class="card w-96 bg-base-100 shadow-xl" @submit.prevent="login">
            <div class="card-body">
                <h2 class="card-title">Khanza Desktop</h2>

                <label class="label text-xs">Username</label>
                <input v-model="username" type="text" class="input input-bordered w-full" autofocus />

                <label class="label text-xs">Password</label>
                <input v-model="password" type="password" class="input input-bordered w-full" />

                <p v-if="error" class="text-error text-sm mt-2">{{ error }}</p>

                <button type="submit" class="btn btn-primary mt-4" :disabled="loading">
                    {{ loading ? 'Masuk...' : 'Masuk' }}
                </button>

                <p class="text-xs text-base-content/50 mt-2">
                    Default: admin / admin123 (wajib ganti password setelah login pertama)
                </p>
            </div>
        </form>
    </div>
</template>
