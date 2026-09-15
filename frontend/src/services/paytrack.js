import { request,queryString } from './api'
import { toCents,fromCents } from '../../../shared/money.js'

export { toCents,fromCents }
export const formatCurrency = (value) => new Intl.NumberFormat('pt-BR',{ style:'currency',currency:'BRL' }).format(value)
export const currentDate = () => new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date())

function clientView(client) {
  return { ...client,cpf:client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'),
    loans:client.loans?.map((loan) => ({ id:loan.id,amount:fromCents(loan.principal_amount),installments:loan.installment_count,
      status:{ active:'ativo',overdue:'negativado',paid:'quitado',cancelled:'Cancelado' }[loan.status],
      startDate:loan.loan_date,endDate:loan.status==='paid' ? loan.paid_at : null,
    })),
  }
}

export function loanView(loan) {
  const installments = loan.installments?.map((item) => ({
    ...item,number:item.installment_number,value:fromCents(item.amount),dueDate:item.due_date,
    currentLateDays:item.days_late,currentLateFee:fromCents(item.late_fee_amount),
    isOverdue:item.status!=='paid' && item.due_date<currentDate(),
  }))
  return { ...loan,companyName:loan.company_name,clientId:loan.client_id,clientName:loan.client_name,amount:fromCents(loan.principal_amount),
    interest:loan.interest_percentage,totalWithInterest:fromCents(loan.total_amount),profit:fromCents(loan.interest_amount),
    installmentCount:loan.installment_count,paidInstallments:loan.paid_installments,
    installmentValue:fromCents(loan.min_installment_amount),
    maxInstallmentValue:fromCents(loan.max_installment_amount),
    dailyLateFee:fromCents(loan.late_fee_per_day),loanDate:loan.loan_date,firstPaymentDate:loan.first_due_date,
    status:loan.display_status,daysLate:loan.days_late,
    installmentRows:installments,
    installments:installments?.map((item) => item.value),
    payments:installments?.filter((item) => item.status==='paid').map((item) => ({
      installmentNumber:item.number,paidAt:item.paid_at,lateDays:item.days_late,
      lateFeeAmount:fromCents(item.late_fee_amount),lateFeeReceivedAmount:fromCents(item.late_fee_paid_amount),
      registeredBy:loan.payments?.filter((payment) => payment.installment_id===item.id && !payment.voided_at && payment.amount>0).at(-1)?.registered_by || 'Não identificado',
    })),
  }
}

export const clientsApi = {
  async list(query,signal) { const result=await request(`/clients?${queryString(query)}`,{ signal }); return { ...result,items:result.items.map(clientView) } },
  async get(id) { return clientView(await request(`/clients/${id}`)) },
  async save(id,body) { return clientView(await request(id ? `/clients/${id}` : '/clients',{ method:id ? 'PATCH':'POST',body })) },
}
export const loansApi = {
  async list(query,signal) { const result=await request(`/loans?${queryString(query)}`,{ signal }); return { ...result,items:result.items.map(loanView) } },
  async get(id) { return loanView(await request(`/loans/${id}`)) },
  async create(form) {
    return loanView(await request('/loans',{ method:'POST',body:{
      company_id:Number(form.companyId),client_id:Number(form.clientId),principal_amount:toCents(form.amount),interest_percentage:String(form.interest || 0),
      installment_count:Number(form.installmentCount),late_fee_per_day:toCents(form.dailyLateFee),
      loan_date:form.loanDate,first_due_date:form.firstPaymentDate,
      installments:form.installments.map(toCents),
      installment_overrides:Object.fromEntries(Object.entries(form.installmentOverrides || {}).map(([key,value]) => [key,toCents(value)])),
    } }))
  },
  async confirm(id,revision,payments) {
    return loanView(await request(`/loans/${id}/payment-confirmation`,{ method:'PUT',body:{ revision,payments:payments.map((item) => ({
      installment_number:item.installmentNumber,payment_date:item.paidAt,late_fee_received_amount:toCents(item.lateFeeReceivedAmount),
    })) } }))
  },
}

export async function getMonthlyReport(query,signal) {
  const result=await request(`/reports?${queryString({ ...query,mode:'month' })}`,{ signal })
  const mapMoney = (record,keys) => ({ ...record,...Object.fromEntries(keys.map((key) => [key,fromCents(record[key])])) })
  return { ...result,
    summary:mapMoney(result.summary,['capital','received','pending','expectedProfit','realizedProfit']),
    contracts:result.contracts.map((row) => mapMoney(row,['amount'])),
    contractStatuses:result.contractStatuses.map((row) => mapMoney(row,['expected','pending'])),
    agenda:result.agenda.map((row) => mapMoney(row,['expected','received'])),
    receiptDays:result.receiptDays.map((item) => mapMoney(item,['value'])),
  }
}

export async function getDashboard() { return request('/dashboard/summary') }
export async function getNotifications() {
  return (await request('/notifications')).map((item) => ({ ...item,
    amount:item.amount == null ? '' : formatCurrency(fromCents(item.amount)),overdueDays:`${item.days_late} dias de atraso`,
    datetime:item.datetime.includes('T') ? item.datetime : item.datetime.replace(' ','T')+'Z',
  }))
}
