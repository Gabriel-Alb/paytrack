export const calculateLoanTotal = (amount, interest) => {
  const normalizedAmount = Number(amount) || 0
  const normalizedInterest = Number(interest) || 0

  return normalizedAmount + (normalizedAmount * normalizedInterest) / 100
}

export const distributeInstallments = (total, count) => {
  const normalizedTotal = Math.round((Number(total) || 0) * 100)
  const normalizedCount = Math.max(Number(count) || 0, 0)

  if (!normalizedTotal || !normalizedCount) {
    return []
  }

  const baseValue = Math.floor(normalizedTotal / normalizedCount)
  let remainingCents = normalizedTotal - baseValue * normalizedCount

  return Array.from({ length: normalizedCount }, () => {
    const additionalCent = remainingCents > 0 ? 1 : 0

    if (remainingCents > 0) {
      remainingCents -= 1
    }

    return (baseValue + additionalCent) / 100
  })
}

export const rebalanceInstallments = (installments, changedIndex, changedValue, total) => {
  const totalInCents = Math.round((Number(total) || 0) * 100)
  const changedValueInCents = Math.min(
    Math.max(Math.round((Number(changedValue) || 0) * 100), 0),
    totalInCents,
  )

  const remainingIndexes = installments
    .map((_, index) => index)
    .filter((index) => index !== changedIndex)

  if (!remainingIndexes.length) {
    return [totalInCents / 100]
  }

  let remaining = totalInCents - changedValueInCents
  const baseValue = Math.floor(remaining / remainingIndexes.length)
  let remainingCents = remaining - baseValue * remainingIndexes.length

  return installments.map((_, index) => {
    if (index === changedIndex) {
      return changedValueInCents / 100
    }

    const additionalCent = remainingCents > 0 ? 1 : 0

    if (remainingCents > 0) {
      remainingCents -= 1
    }

    return (baseValue + additionalCent) / 100
  })
}

export const getLoanStatus = (daysLate = 0) => {
  if (daysLate <= 0) {
    return 'on-time'
  }

  if (daysLate <= 2) {
    return 'attention'
  }

  return 'overdue'
}
