const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const fmt = (n: number) => number.format(Math.round(n))
