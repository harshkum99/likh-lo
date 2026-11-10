/** Keep digits and one decimal point (max 2 decimals); commas are dropped so "1,500" reads as 1500. */
export function cleanAmountInput(v: string): string {
  const [int, ...dec] = v.replace(/[^\d.]/g, '').split('.')
  return dec.length ? `${int.slice(0, 9)}.${dec.join('').slice(0, 2)}` : int.slice(0, 9)
}
