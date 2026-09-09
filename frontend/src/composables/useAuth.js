import { ref, readonly } from 'vue'
import { request, setCsrfToken, setUnauthorizedHandler, apiError, apiNotice } from '../services/api.js'

const user = ref(null)
let restoring
let expired = () => {}
setUnauthorizedHandler((path) => {
  user.value = null
  apiNotice.value = ''
  // The router already owns navigation during /me restoration. Redirecting here
  // would cancel that navigation and start another /me request indefinitely.
  if (path !== '/auth/me') expired()
})
export const onSessionExpired = (handler) => { expired = handler }
export async function restoreAuth() {
  if (!restoring) restoring = request('/auth/me').then((result) => {
    user.value = result.user
    return user.value
  }).catch((error) => {
    user.value = null
    if (error.status !== 401) apiError.value = 'Não foi possível verificar a sessão. Tente novamente.'
    return null
  }).finally(() => { restoring = undefined })
  return restoring
}
export function useAuth() {
  return {
    user: readonly(user),
    async updateProfile(body) {
      const result = await request('/auth/me',{method:'PATCH',body})
      user.value = result.user
    },
    async login(body) {
      const result = await request('/auth/login',{method:'POST',body})
      user.value = result.user
      setCsrfToken(result.csrfToken)
      apiError.value = ''
      apiNotice.value = ''
    },
    async logout() {
      await request('/auth/logout',{method:'POST'})
      user.value = null
      setCsrfToken('')
      apiError.value = ''
      apiNotice.value = ''
    },
    async changePassword(body) {
      await request('/auth/change-password',{method:'POST',body})
      user.value = null
      setCsrfToken('')
    },
  }
}
