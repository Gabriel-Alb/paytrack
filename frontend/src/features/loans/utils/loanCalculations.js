export const calculateLoanTotal = (amount, interest) => {
  const normalizedAmount = Number(amount) || 0
  const normalizedInterest = Number(interest) || 0

  return normalizedAmount + (normalizedAmount * normalizedInterest) / 100
}
