import { ref } from 'vue'
import { toast } from '../composables/useToast.js'

export const pendingOperation = ref(false)
const baseUrl = import.meta.env?.VITE_API_URL || '/api'
export const watchAccessChanges = (refresh) => {
  const events = new EventSource(`${baseUrl}/users/events`, { withCredentials: true })
  events.onmessage = refresh
  return () => events.close()
}
let csrfToken = ''
let csrfPromise
let onUnauthorized = () => {}
export const setCsrfToken = (value) => { csrfToken = value || '' }
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler }
async function getCsrf() {
  if (csrfToken) return csrfToken
  if (!csrfPromise) csrfPromise = request('/auth/csrf').then((result) => {
    csrfToken = result.csrfToken
    return csrfToken
  }).finally(() => { csrfPromise = undefined })
  return csrfPromise
}

export async function request(path,{ method='GET',body,signal }={}, retry=true) {
  const headers = body === undefined ? {} : { 'Content-Type':'application/json' }
  if (!['GET','HEAD'].includes(method)) headers['X-CSRF-Token'] = await getCsrf()
  let response
  try {
    response = await fetch(`${baseUrl}${path}`,{
      method,signal,credentials:'include',headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.', { cause })
  }
  if (response.status === 204) return null
  let result
  try { result = await response.json() }
  catch {
    throw new Error('O servidor retornou uma resposta inesperada. Tente novamente.')
  }
  if (!response.ok) {
    if (result?.error?.code === 'CSRF_INVALID' && retry) {
      setCsrfToken('')
      return request(path,{method,body,signal},false)
    }
    if (response.status === 401 && result?.error?.code === 'UNAUTHENTICATED') {
      setCsrfToken('')
      onUnauthorized(path)
    }
    const details = Array.isArray(result?.error?.details) ? result.error.details.map((item) => `${item.field}: ${item.message}`).join(' ') : ''
    const error = new Error(details || result?.error?.message || 'Não foi possível concluir a operação.')
    error.code = result?.error?.code
    error.status = response.status
    throw error
  }
  return result
}

export async function perform(operation) {
  if (pendingOperation.value) return
  pendingOperation.value = true
  try { return await operation() }
  catch (error) { toast.error(error) }
  finally { pendingOperation.value = false }
}

export function queryString(query) {
  return new URLSearchParams(Object.entries(query).filter(([,value]) => value !== undefined && value !== '' && value !== 'todos')).toString()
}
