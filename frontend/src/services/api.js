import { ref } from 'vue'

export const apiError = ref('')
export const pendingOperation = ref(false)
const baseUrl = import.meta.env.VITE_API_URL || '/api'

export async function request(path,{ method='GET',body,signal }={}) {
  const response = await fetch(`${baseUrl}${path}`,{
    method,signal,
    headers: body === undefined ? {} : { 'Content-Type':'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) {
    const details = result.error?.details?.map((item) => `${item.field}: ${item.message}`).join(' ')
    throw new Error(details || result.error?.message || 'Não foi possível concluir a operação.')
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
