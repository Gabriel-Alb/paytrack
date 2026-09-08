import { toCents, fromCents, interestAmount } from '../../../../../shared/money.js'

export const calculateLoanTotal = (amount, interest) => {
  try {
    const principal = toCents(amount)
    return fromCents(principal + interestAmount(principal, interest || 0))
  } catch { return '0.00' }
}
