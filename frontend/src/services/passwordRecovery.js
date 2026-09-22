import { request, queryString } from './api.js'

export const passwordRecoveryApi = {
  request: email => request('/auth/forgot-password', { method:'POST',body:{email} }),
  list: query => request(`/users/password-reset-requests?${queryString(query)}`),
  approve: id => request(`/users/password-reset-requests/${id}/approve`, { method:'POST',body:{} }),
  reject: id => request(`/users/password-reset-requests/${id}/reject`, { method:'POST',body:{} }),
}
