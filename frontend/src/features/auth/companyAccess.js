export const canAdminister = user => user?.role === 'admin' || !!user?.managedCompanyIds?.length
export const canManageCompany = (user, id) => user?.role === 'admin' || !!user?.managedCompanyIds?.includes(id)
export function companyDecisions(rows, choices) {
  return rows.filter(row => row.status === 'pending' && choices[row.id]?.action)
    .map(row => choices[row.id].action === 'reject'
      ? { companyId: row.id, action: 'reject' }
      : { companyId: row.id, action: 'approve', role: choices[row.id].role || 'USER' })
}
