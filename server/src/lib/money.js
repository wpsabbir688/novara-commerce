// Money helpers. All amounts are INTEGER minor units (BDT poisha).
// Never use floating-point arithmetic for money.

export const toMinor = (major) => Math.round(Number(major) * 100);

export const fromMinor = (minor) => minor / 100;

export const formatBDT = (minor) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(minor / 100);

/** Percent discount on a minor-unit amount, rounded to the nearest poisha. */
export const percentOf = (amountMinor, percent) => Math.round((amountMinor * percent) / 100);

/** Sum of line totals: [{unitPrice, quantity}] -> minor units. */
export const sumLines = (lines) =>
  lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
