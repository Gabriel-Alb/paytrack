import { ref } from 'vue'

export const apiError = ref('')
export const apiNotice = ref('')
export const pendingOperation = ref(false)
const baseUrl = import.meta.env?.VITE_API_URL || '/api'
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
  const response = await fetch(`${baseUrl}${path}`,{
    method,signal,credentials:'include',headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (result.error?.code === 'CSRF_INVALID' && retry) {
      setCsrfToken('')
      return request(path,{method,body,signal},false)
    }
    if (response.status === 401 && result.error?.code === 'UNAUTHENTICATED') {
      setCsrfToken('')
      onUnauthorized(path)
    }
    const details = result.error?.details?.map((item) => `${item.field}: ${item.message}`).join(' ')
    const error = new Error(details || result.error?.message || 'Não foi possível concluir a operação.')
    error.code = result.error?.code
    error.status = response.status
    throw error
  }
  return result
}

export async function perform(operation) {
  if (pendingOperation.value) return
  pendingOperation.value = true
  apiError.value = ''
  try { return await operation() }
  catch (error) { apiError.value = error.message || 'Não foi possível conectar à API.' }
  finally { pendingOperation.value = false }
}

export function queryString(query) {
  return new URLSearchParams(Object.entries(query).filter(([,value]) => value !== undefined && value !== '' && value !== 'todos')).toString()
}
