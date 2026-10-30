const credits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatCredits(n: number): string {
  return credits.format(n);
}

// Латинская x: в шрифте Clickable Black нет знака ×
export function formatMultiplier(m: number): string {
  return `${Number(m.toFixed(2))}x`;
}
