export function toCents(value) {
  const text = String(value ?? '0').trim() || '0'
  if (!/^\d+(\.\d{0,2})?$/.test(text)) throw new Error('Informe um valor com até duas casas decimais.')
  const [whole,fraction=''] = text.split('.')
  const result = BigInt(whole)*100n + BigInt(fraction.padEnd(2,'0'))
  if (result>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Valor acima do limite permitido.')
  return Number(result)
}

export function fromCents(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário inválido.')
  const sign = value<0 ? '-' : ''
  const absolute = Math.abs(value)
  return `${sign}${Math.floor(absolute/100)}.${String(absolute%100).padStart(2,'0')}`
}

export function interestAmount(principal,percentage) {
  return Number((BigInt(principal)*BigInt(toCents(percentage))+5000n)/10000n)
}

export function proportionalAmount(amount,numerator,denominator) {
  return Number((BigInt(amount)*BigInt(numerator)+BigInt(denominator)/2n)/BigInt(denominator))
}
